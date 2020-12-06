---
title: TCP/UDP总结与梳理
date: 2020-12-06 14:31:04
tags:
  - TCP
categories: 网络
---

TCP也是老生常谈了，在四层协议栈中基本是必知必会，还拥有大量的八股文面试内容，本篇旨在思考与总结协议栈的相关知识，梳理一下加深一下理解，也希望能有更深入的理解，不是面向面试学习。

 <!--more-->



## 讲讲TCP

应用层协议总是离不开TCP作为基础，面向连接为应用层协议屏蔽了更多的网络层的感知，那什么是「面向连接」？

[RFC 793 - Transmission Control Protocol](https://tools.ietf.org/html/rfc793)

第四页：

> Connections:
> 
>    ​	 The reliability and flow control mechanisms described above require
>    ​	 that TCPs initialize and maintain certain status information for
>    ​	 each data stream.  The combination of this information, including
>    ​	 sockets, sequence numbers, and window sizes, is called a connection.

告诉我们连接用于保证可靠性和流控制机制的信息，包括了三个部分：

	* Socket
	* 序列号
	* 窗口大小

那么我们可以理解为对与一个连接来说，需要维护两端的上述三种信息共识：连接Socket用于标示基础信息：互联网地址标示、端口信息；窗口用来做流量控制；序列号用来追踪发送顺序与发送状态的确认。



### 三次握手

那如何建立这三种信息的基本共识呢？又回到了大家熟悉无比的三次握手：

![basic-3-way-handshake](basic-3-way-handshake.png)

需要注意的是，这里说三次握手建立三种信息共识并不是说三次握手的主要目的是建立三种信息的共识，共识严格来说基于约定，要完全保证100%安全可靠的共识和这里说的共识不是一路货色，这里只是说这个基本共识在这三次握手的过程中达成了。

那么就有了一些延伸的问题，为什么要三次握手才能实现共识？四次行不行？两次行不行？为了什么？

相信大家但凡面试都躲不过这几个烂问题，求职者也是基于各路博客自身理解各显神通然后将这问题扣上一顶「八股文」的大帽打入冷宫不在思考，但是这样真的好么？

#### 关于次数的思考

首先我们不考虑使用四次行不行这种问题，如果一个事情能用三次解决就必然可以用四次解决，同样也可以100次解决，只是效率低而已，我们不需要进行拓展的讨论。

那么少点呢？用两次可以么？A告诉B自己的地址/序列号/窗口大小，B再告诉A自己的地址/序列号/窗口大小是不是就可以了呢？

实际上，在完美的网络环境下（所有均可达/均有序）确实可以，但是网络总是充满了不确定性：

![tcp-recovery-from-old-duplicate-syn](tcp-recovery-from-old-duplicate-syn.png)

只要网络状况不好，A发起重试，两个请求连接的数据包到B，B该如何处置？丢弃哪一个，如何分辨是不是因为网络超时而晚到的历史连接？

所以便有了三次握手与RST控制消息，将连接的建立权移交给连接发起放，接受方将连接建立的序列号+1作为当前连接建立的回复序列号发送给发起方（SEQ）,发起方就可以根据SEQ反推出发起的连接是否超时，超时则回复RST释放资源，正常则ACK确认连接。你看，这下连序列号同步（SYN）也做了，自然就不需要第四次握手了。

RFC中也是说明主要解决重复的历史连接问题：
[RFC 793 - Transmission Control Protocol](https://tools.ietf.org/html/rfc793)

第31页：

> The principle reason for the three-way handshake is to prevent old
> duplicate connection initiations from causing confusion.

RFC中也有示意图，童鞋们自行采阅。


### 数据传输
连接建立啦，自然要开始传输信息了，那么我们该如何传输数据呢？直接怼上去一个包搞定所有数据那肯定不行🙅，万一我这数据多咋整，链路上设备不支持给我包阉了咋整？所以我们在发送前，还要做好分包，做分包前还要知道当前链路支持我怎么分包，那么问题简化为一下三个步骤：
 * 调查链路上可以接受的包大小
 * 分析当前数据大小进行拆包
 * 发送数据包并填充序列号
 * 接收端获取数据包并回复ACK
 * 发送方获取ACK移动发送窗口or重发

#### 如何调查链路上可以接受的包大小？

这里有个「路径最大传输单元发现」（Path MTU Discovery，PMTUD）机制来确定两个主机间的最大传输单元（MTU）,工作原理如下：

1. 向目的主机发送 IP 头中 DF 控制位为 1 的数据包，DF 是不分片（Don’t Fragment，DF）的缩写
2. 路径上的网络设备根据数据包的大小和自己的 MTU 做出不同的决定：
   * 如果数据包大于设备的 MTU，就会丢弃数据包并发回一个包含该设备 MTU 的 ICMP 消息；
   * 如果数据包小于设备的 MTU，就会继续向目的主机传递数据包；
3. 源主机收到 ICMP 消息后，会不断使用新的 MTU 发送 IP 数据包，直到 IP 数据包达到目的主机

这里有个问题需要注意，linux默认是开启该方式的，你可以通过修改配置关闭PMTUD配置，那么会在发真实数据的时候被中间链路的设备拒绝，然后再重新设置MTU进行重试。

一般的路由设备的MTU是1500个字节，
 * 对于IP协议来说，要剪掉20个协议头的大小，那么通常的IP包就是1480个字节
 * 对于TCP协议来说，要剪掉20个IP协议头，20个TCP协议头，就是1460个字节
 * 对于UDP协议来说，要剪掉20个IP协议头，8个UDP协议头，就是1472个字节
### 四次挥手



## TODO: 本子没电了，明日再写

