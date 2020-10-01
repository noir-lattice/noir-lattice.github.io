---
title: Spring Cloud Gateway接入Sentinel
date: 2020-10-01 20:35:07
tags:
  - Spring Cloud Alibaba
  - Gateway
categories: java
---

## 简介
本文用作记录Sentinel接入Spring Cloud Alibaba。

## 搭建Sentinel Dashboard

 * [官方jar包启动](https://github.com/alibaba/Sentinel/wiki/%E6%8E%A7%E5%88%B6%E5%8F%B0)

 * docker启动
```
docker run --restart=always -d -it --name sentinel-dashboard -p 8858:8858 bladex/sentinel-dashboard
```

当然我直接在Rancher商城里面直接构建的（嘿嘿


## 项目引入
 * 添加mvn依赖
    ```xml
    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-starter-alibaba-sentinel</artifactId>
    </dependency>

    <dependency>
        <groupId>com.alibaba.cloud</groupId>
        <artifactId>spring-cloud-alibaba-sentinel-gateway</artifactId>
    </dependency>

    <dependency>
        <groupId>org.springframework.cloud</groupId>
        <artifactId>spring-cloud-starter-gateway</artifactId>
    </dependency>
    ```
 * 添加配置
    ```yaml
    spring:
      cloud:
        sentinel:
          transport:
            port: 8719  # sentinel规则接接收客户端口
            dashboard: 192.168.3.50:8858
    ```
  * 随便发起一个请求后可以在sentinel dashboard看到对应服务