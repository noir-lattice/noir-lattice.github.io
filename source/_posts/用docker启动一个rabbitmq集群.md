---
title: 用docker启动一个rabbitmq集群
date: 2020-05-16 20:28:09
tags:
  - 消息队列
categories: 中间件
---

## 集群概念
RabbitMQ有三种集群方式： 单机集群、普通集群和镜像集群。单机集群就跟玩似的，基本没有生产意义。

### 普通集群
这里包括几个概念：交换器、队列元数据、队列内容

 * Exchange 的元数据信息在所有节点上是一致的，而 Queue（存放消息的队列）的完整数据则只会存在于创建它的那个节点上。
 * RabbitMQ 集群会始终同步四种类型的内部元数据（类似索引）：
    * 队列元数据：队列名称和它的属性；
    * 交换器元数据：交换器名称、类型和属性；
    * 绑定元数据：一张简单的表格展示了如何将消息路由到队列；
    * vhost元数据：为 vhost 内的队列、交换器和绑定提供命名空间和安全属性；
  因此，当用户访问其中任何一个 RabbitMQ 节点时，通过 rabbitmqctl 查询到的元数据信息都是相同的。
 * 无法实现高可用性，当创建 queue 的节点故障后，其他节点是无法取到消息实体的。

### 镜像集群模式
把队列做成镜像队列，让各队列存在于多个节点中，属于 RabbitMQ 的高可用性方案。镜像模式和普通模式的不同在于，queue和 message 会在集群各节点之间同步，而不是在 consumer 获取数据时临时拉取。

## 普通集群部署
1. 拉取镜像
```bash
docker pull rabbitmq:management
```

2. 运行容器
```bash
docker run -d --hostname rabbit_host1 \
    --name rabbitmq1 -p 15672:15672 -p 5672:5672 \
    -e RABBITMQ_ERLANG_COOKIE='rabbitmq_cookie' \
    rabbitmq:management
docker run -d --hostname rabbit_host2 \
    --name rabbitmq2 -p 5673:5672 \
    --link rabbitmq1:rabbit_host1 \
    -e RABBITMQ_ERLANG_COOKIE='rabbitmq_cookie' \
    rabbitmq:management
docker run -d --hostname rabbit_host3 \
    --name rabbitmq3 -p 5674:5672 \
    --link rabbitmq1:rabbit_host1 \
    --link rabbitmq2:rabbit_host2 \
    -e RABBITMQ_ERLANG_COOKIE='rabbitmq_cookie' \
    rabbitmq:management
```
参数解释：
 * -p 15672:15672 management 界面管理访问端口，这里只开放了rabbitmq1
 * -p 5672:5672 amqp 访问端口
 * --link 容器之间连接
 * --hostname 当前容器的host
 * Erlang Cookie 必须相同，Erlang节点通过交换 Erlang Cookie 获得认证。

2. 加入节点到集群
  * 节点2
  ```bash
  docker exec -it rabbitmq2 bash
  > rabbitmqctl stop_app
  > rabbitmqctl reset
  > rabbitmqctl join_cluster --ram rabbit@rabbit_host1
  > rabbitmqctl start_app
  > exit
  ```

  * 节点3
  ```bash
  docker exec -it rabbitmq3 bash
  > rabbitmqctl stop_app
  > rabbitmqctl reset
  > rabbitmqctl join_cluster --ram rabbit@rabbit_host1
  > rabbitmqctl start_app
  > exit
  ```
  --ram 表示设置为内存节点，忽略该参数默认为磁盘节点。该配置启动了3个节点，1个磁盘节点和2个内存节点。

3. 访问管理端
可以通过guest/guest访问刚才在节点1上暴露的管理端口的页面：http://ip:15672
![mq_management](mq_management.png)

## 镜像集群部署

1. 策略policy概念  

  使用RabbitMQ镜像功能，需要基于RabbitMQ策略来实现，策略policy是用来控制和修改群集范围的某个vhost队列行为和Exchange行为。策略policy就是要设置哪些Exchange或者queue的数据需要复制、同步，以及如何复制同步。  

  为了使队列成为镜像队列，需要创建一个策略来匹配队列，设置策略有两个键“ha-mode和 ha-params（可选）”。ha-params根据ha-mode设置不同的值，下表说明这些key的选项。
  ![ha-policy](ha-policy.png)

2. 添加策略
  * 登录rabbitmq管理页面 ——> Admin ——> Policies ——> Add / update a policy
    ![add-policy](add-policy.png)
  * 或者通过指令
    ```bash
    rabbitmqctl set_policy ha-all "^" '{"ha-mode":"all"}'
    ```