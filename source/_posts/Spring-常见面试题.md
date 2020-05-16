---
title: Spring 常见面试题
date: 2020-05-16 15:28:45
tags:
  - Spring
categories: 面试
---

## 介绍下Spring
它是一个一站式（full-stack全栈式）框架，提供了从表现层-springMVC到业务层-spring再到持久层-springdata的一套完整的解决方案。我们在项目中可以只使用spring一个框架，它就可以提供表现层的mvc框架，持久层的Dao框架。它的两大核心IoC和AOP更是为我们程序解耦和代码简洁易维护提供了支持。

## Spring中AOP的应用场景、Aop原理、好处

### 场景
  Authentication 权限、Caching 缓存、Context passing 内容传递、Error handling 错误处理Lazy loading懒加载、Debugging调试、logging, tracing, profiling and monitoring 记录跟踪优化　校准、Performance optimization　性能优化、Persistence 持久化、Resource pooling　资源池、Synchronization　同步、Transactions 事务

### 原理
  AOP是面向切面编程是代理模式的实现，是通过动态代理的方式为程序添加统一功能，集中解决一些公共问题。

### 优点
  * 各个步骤之间的良好隔离性耦合性大大降低 
  * 源代码无关性，再扩展功能的同时不对源码进行修改操作。

## 细说Spring AOP原理 
  * 每个 Bean 都会被 JDK 或者 Cglib 代理。取决于是否有接口。
  * 每个 Bean 会有多个“方法拦截器”。注意：拦截器分为两层，外层由 Spring 内核控制流程，内层拦截器是用户设置，也就是 AOP。
  * 当代理方法被调用时，先经过外层拦截器，外层拦截器根据方法的各种信息判断该方法应该执行哪些“内层拦截器”。内层拦截器的设计就是职责链的设计。

## Spring的IOC
对于 IoC 来说，最重要的就是容器。容器管理着 Bean 的生命周期，控制着 Bean 的依赖注入。

Spring设计了两个接口用以表示容器。
 * BeanFactory
 * ApplicationContext

### BeanFactory
粗暴简单，可以理解为就是个 HashMap，Key 是 BeanName，Value 是 Bean 实例。通常只提供注册（put），获取（get）这两个功能。我们可以称之为 “低级容器”。

### ApplicationContext
ApplicationContext 可以称之为 “高级容器”。因为他比 BeanFactory 多了更多的功能。他继承了多个接口。因此具备了更多的功能。例如资源的获取，支持多种消息（例如 JSP tag 的支持），对 BeanFactory 多了工具级别的支持等待。所以你看他的名字，已经不是 BeanFactory 之类的工厂了，而是 “应用上下文”， 代表着整个大容器的所有功能。该接口定义了一个 refresh 方法，此方法是所有阅读 Spring 源码的人的最熟悉的方法，用于刷新整个容器，即重新加载/刷新所有的 bean。