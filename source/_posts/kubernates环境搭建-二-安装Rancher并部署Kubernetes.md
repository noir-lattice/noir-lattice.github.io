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