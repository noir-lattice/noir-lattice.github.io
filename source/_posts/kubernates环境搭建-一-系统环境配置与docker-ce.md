---
title: 'kubernates环境搭建(一): 系统环境配置与docker-ce'
date: 2019-08-07 14:11:35
tags:
  - kubernetes
categories: kubernetes
---

## 序言
这是kubernates环境搭建的第一篇，我们要做的是尽可能的记录部署过程，为各位未来更好的理解与使用kubernetes做好基础准备。
需要的环境：
  * Centos7 4c8m * 3 (系统非必须要求，其他linux发现版同理，此处使用三台并不是一定要三台，你自己all-in-one也行)
  * 清醒的头脑
  * 还算不错的网络
主机环境：
  * node01 - 192.168.1.10/24
  * node02 - 192.168.1.11/24
  * node03 - 192.168.1.12/24
<!--more-->

## 关闭selinux
```shell
setenforce 0
sudo sed -i 's/SELINUX=enforcing/SELINUX=disabled/g' /etc/selinux/config
systemctl stop firewalld.service && systemctl disable firewalld.service
```

## 设置语言与时区
```shell
ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
sudo echo 'LANG="en_US.UTF-8"' >> /etc/profile;source /etc/profile
```

## 依照主机名配置host
```shell
[root@rancher ~]# cat /etc/hosts
127.0.0.1   localhost localhost.localdomain localhost4 localhost4.localdomain4
::1         localhost localhost.localdomain localhost6 localhost6.localdomain6
192.168.1.10 node01
192.168.1.11 node02
192.168.1.12 node03
```

## 配置三台主机的时间同步
使用云服务时一般已配置好时间同步，这里只是说明一下，如要详细配置：
![你不会搜索么？](search.jpg)

## 网络配置优化
```shell
cat >> /etc/sysctl.conf<<EOF
net.ipv4.ip_forward=1
net.bridge.bridge-nf-call-iptables=1
net.ipv4.neigh.default.gc_thresh1=4096
net.ipv4.neigh.default.gc_thresh2=6144
net.ipv4.neigh.default.gc_thresh3=8192
EOF
sysctl -p
```

## 添加系统模块
```shell
[root@rancher ~] cat add_mod.sh
\#!/bin/sh
mods=(
br_netfilter
ip6_udp_tunnel
ip_set
ip_set_hash_ip
ip_set_hash_net
iptable_filter
iptable_nat
iptable_mangle
iptable_raw
nf_conntrack_netlink
nf_conntrack
nf_conntrack_ipv4
nf_defrag_ipv4
nf_nat
nf_nat_ipv4
nf_nat_masquerade_ipv4
nfnetlink
udp_tunnel
VETH
VXLAN
x_tables
xt_addrtype
xt_conntrack
xt_comment
xt_mark
xt_multiport
xt_nat
xt_recent
xt_set
xt_statistic
xt_tcpudp
)
for mod in ${mods[@]};do
    modprobe $mod
        lsmod |grep $mod
done
chmod a+x add_mod.sh
./add_mod.sh
```

## 安装Docker-ce
```shell
curl https://releases.rancher.com/install-docker/17.06.sh | sh
```
注意这里需要下载Rancher支持的版本（https://rancher.com/docs/rancher/v2.x/en/installation/requirements/）

## 配置守护进程
```shell
[root@node01 ~]# cat /etc/docker/daemon.json
{
  "registry-mirrors": ["https://xxxxx.xxx.com/"],
  "insecure-registries": ["192.168.1.10","IP:PORT"]
  "max-concurrent-downloads": 3,
  "max-concurrent-uploads": 5,
  "storage-driver": "overlay2",
  "storage-opts": ["overlay2.override_kernel_check=true"],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "3"
  }
}
```
配置说明：
  * registry-mirrors: 国内镜像加速地址
  * insecure-registries: 非TLS私有registry地址
  * max-concurrent-downloads: 同时docker pull的并发数量（不设置在过高的并发时会lock网络，出一个docker的bug;过低会lock后续pull）
  * max-concurrent-uploads: 同时docker push的并发数
  * storage-driver和storage-opts: 容器存储驱动（注意overlay2需要ext4,xfs需要开启d_type）
  * log-driver和log-opts配置日志，防止日志过多撑爆硬盘

重启服务：
```shell
sudo service restart docker
```

## 其他的方式
上面的操作每一台都要做，就算写成脚本也累死个人，所以建议安装RancherOS，自带docker-ce，你只要配制下守护进程重启下docker服务就好了。
![saywhat](saywhat.jpg)