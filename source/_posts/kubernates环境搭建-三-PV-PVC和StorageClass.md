---
title: 'kubernates环境搭建(三): PV/PVC和StorageClass'
date: 2019-08-22 09:46:33
tags:
  - kubernetes
categories: kubernetes
---

## 简介
当你使用容器部署数据应用时，可能为了备份的便利或者数据安全将数据挂在在硬盘或者其他网络存储上，本文以NFS作为StorageClass部署并集成到kubernetes集群作为示例简述相关环境的搭建。 
<!--more-->
### 名称解释
  * PV(PersistentVolume): 一段网络存储，是归属于kubernetes管理的集群资源。
  * PVC(PersistentVolumeClaim): 用户的存储请求，PVC消耗PV资源并可以声明大小和读写权限
  * StorageClass: 为管理员提供了一种描述他们提供的存储的“类”的方法。 不同的类可能映射到服务质量级别，或备份策略，或者由群集管理员确定的任意策略。

### Lifecycle
  Provisioning ——-> Binding ——–> Using ——> Releasing ——> Recycling
  * Provisioning: 准备供应PV
  * Binding: 根据PVC绑定PV
  * Using: 正常挂载使用
  * Releasing: 解除绑定并保留数据准备根据Recycling策略进行回收或删除
  * Recycling: 回收，有三种策略：保留、删除和回收（不同的存储引擎或云提供商支持的策略不同）

## 搭建NFS服务器
使用硬盘读写高并且与kubernetes集群网络质量高的一天主机进行部署NFS服务器作为网络存储。
```bash
#master节点安装nfs
yum -y install nfs-utils

#创建nfs目录
mkdir -p /nfs/data/

#修改权限
chmod -R 777 /nfs/data

#编辑export文件
vim /etc/exports
/nfs/data *(rw,no_root_squash,sync)

#配置生效
exportfs -r
#查看生效
exportfs

#启动rpcbind、nfs服务
systemctl restart rpcbind && systemctl enable rpcbind
systemctl restart nfs && systemctl enable nfs

#查看 RPC 服务的注册状况
rpcinfo -p localhost
```

## kubernetes集群安装nfs-client-provisioner
```bash
#指定nfs服务器ip和导出的路径
helm install --name nfs-client --set nfs.server=x.x.x.x --set nfs.path=/exported/path stable/nfs-client-provisioner
```

## 查看配置存储类
安装好nfs-client-provisioner的charts后会自动创建对应的StorageClass，可以直接在rancher的管理台上查看和修改配置。  

  ![管理存储类](rancher.png)  

修改默认存储类  

  ![修改默认存储类](change-default.png)