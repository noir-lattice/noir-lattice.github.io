---
title: 'kubernates环境搭建(二): 安装Rancher并部署Kubernetes'
date: 2019-08-07 15:26:25
tags:
  - kubernetes
  - rancher
categories: kubernetes
---

## 安装Rancher
找个node节点外的机器安装Rancher（当然你可以在node上装然后换掉80和443接口），此处新开机器 rancher - 192.168.1.13
```shell
sudo docker run -d --restart=unless-stopped -p 80:80 -p 443:443 rancher/rancher:stable
```
等待容器启动后访问https://192.168.1.13，按照提示设置密码、设置语言与确认访问路径（注意确认地址为node可以访问的地址）。

## 创建集群
  * 添加集群
  ![添加集群](add-1.png)
  * 选择部署类型与集群名称
  ![选择部署类型与集群名称](add-2.png)
  * 选择角色并部署节点
  ![选择角色并部署节点](add-3.png)
  * 等待集群Active

## 配置部署工具
  * 获取配置
  ![获取配置](config-1.png)
  * 保存配置文件
  ![保存配置文件](config-2.png)
  * [下载kubectl](https://www.cnrancher.com/docs/rancher/v2.x/cn/install-prepare/download/kubernetes/)
  * [下载helm](https://www.cnrancher.com/docs/rancher/v2.x/cn/install-prepare/download/helm/)
  * 初始化tiller
  ```shell
  helm version #获取TILLER_VERSION
  helm init --upgrade -i registry.cn-hangzhou.aliyuncs.com/google_containers/tiller:$TILLER_VERSION --stable-repo-url https://kubernetes.oss-cn-hangzhou.aliyuncs.com/charts #替换$TILLER_VERSION
  ```
  * 设置tiller RBAC
  ```shell
  kubectl --namespace kube-system create serviceaccount tiller
  kubectl create clusterrolebinding tiller --clusterrole cluster-admin --serviceaccount=kube-system:tiller
  helm init --service-account tiller --upgrade
  ```

## 部署kubernetes dashboard
  * 创建配置文件value.yaml
  ```yaml
  # ingress 配置与tls
  # ingress:
  #   tls:
  #   - hosts:
  #     - xxx
  #     secretName: your-secret
  #   enabled: true
  #   hosts:
  #   - xxx
  image:
  repository: docker.io/mirrorgooglecontainers/kubernetes-dashboard-amd64
  tag: v1.10.1
  rbac:
    clusterAdminRole: true
  ```
  * 部署应用
  ```shell
  helm upgrade -f value.yaml dashboard stable/kubernetes-dashboard
  ```
  * 访问测试
  使用保存的kubeconfig成功登入
  ![成功登入](test.png)