---
title: '从代码到线上,高度集成的gitlab工具链(一): CI/CD'
date: 2019-09-12 18:30:12
tags:
  - CI/CD
  - gitlab
categories: devops
---

## 简介  
作为可以私有部署的开源仓库管理系统，gitlab作为一个互联网公司的代码仓库当然是一件寻常的事情了，Gitlab除了git的基础功能，在线的代码审查及review,还有
  * ci/cd工具链
  * gitflow
  * gitpage
  * wiki
  * 项目管理工具支持  

本篇将从各个工具链的搭建将其作用平述。

  <!--more-->
  
## Gitlab环境搭建
gitlab是一个很大的项目，采用微服务架构的同时也支持单机部署，这里作为研发人员使用我们使用最方便运维与部署的容器部署作为实例。
### 获取镜像
```bash
docker pull gitlab/gitlab-ce
```
### 创建挂载目录
```bash
mkdir -p /srv/gitlab/config
mkdir -p /srv/gitlab/logs 
mkdir -p /srv/gitlab/data
```
### 创建容器
```bash
docker run -d --restart=always \
  --name gitlab \
  --hostname gitlab.example.com \
  -p 80:80 -p 22:22 \
  -v /srv/gitlab/config:/etc/gitlab \
  -v /srv/gitlab/logs:/var/log/gitlab \
  -v /srv/gitlab/data:/var/opt/gitlab \
  --privileged=true \
  gitlab/gitlab-ce
```
等待一段时间后docker ps即可看到STATUS为healthy即启动完成可以访问了。

## Gitlab runner部署
Gitlab runnner 可以运行指定作业（通过编写pipeline）与gitlab的ci模块协调作业进行CI/CD。
### 安装gitlab runner
```bash
docker run -d --name gitlab-runner --restart always \
  -v /srv/gitlab-runner/config:/etc/gitlab-runner \
  -v /var/run/docker.sock:/var/run/docker.sock \
  gitlab/gitlab-runner:latest
```
### 注册gitlab runner
在使用root用户登入gitlab后可以进入/admin/runners下获取token进行runner注册
```bash
# 开始注册
docker run --rm -t -i -v /srv/gitlab-runner/config:/etc/gitlab-runner gitlab/gitlab-runner register

# gitlab url
Please enter the gitlab-ci coordinator URL (e.g. https://gitlab.com )
https://gitlab.com

# 输入获取的token
Please enter the gitlab-ci token for this runner
xxx

# 输入该runner的描述
Please enter the gitlab-ci description for this runner
[hostname] my-runner

# 选择改runner执行的标签（不选默认执行所有标签）
Please enter the gitlab-ci tags for this runner (comma separated):
my-tag,another-tag

# 选择runner的执行程序
Please enter the executor: ssh, docker+machine, docker-ssh+machine, kubernetes, docker, parallels, virtualbox, docker-ssh, shell:
docker

# 选择容器的默认镜像
Please enter the Docker image (eg. ruby:2.1):
alpine:latest
```
之后刷新/admin/runners页面发现新的runner就算注册成功了，如果需要多个runner只需重复执行以上步骤创建并注册多个runner container即可。
### 开启DIND的高级权限
DIND(docker in docker)在生产发布时十分有用，在未开启privileged时是无法再自定义任务中使用DIND来打包并发布镜像的。
修改runner container的配置文件/srv/gitlab-runner/config/config.toml，将privileged设置为true后重启该容器。

## 编写并运行我们的第一个pipeline
我们在创建项目后，可以在项目根路径创建.gitlab-ci.yml文件来编写我们的CI/CD任务并在每次提交后自动运行pipeline。
```yaml
stages:
  - test

variables:
  PRINT_WORD: hello

say_hellow:
  stage: test
  script:
    - echo $PRINT_WORD
```
提交一次更改即可在项目的CI/CD-->Pipelines中查验运行结果。
后续我们可以通过编写pipeline集成自动化的ut/it、可以集成helm或kubectl做生产部署、可以通过格式化的测试报表与gitlab页面集成，相比于jenkins的推拉webhook等方式更加与研发平台集成，更加切合Devops的谁开发、谁部署、谁运维。