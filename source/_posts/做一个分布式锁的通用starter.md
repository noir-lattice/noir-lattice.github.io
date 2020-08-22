---
title: 做一个分布式锁的通用starter
date: 2020-08-22 12:58:19
tags:
  - redis
  - zookeeper
  - 分布式资源抢占
categories:
  - 架构
---

## 简介

接上篇  [细谈分布式锁](https://noir-lattice.github.io/2020/07/19/%E7%BB%86%E8%B0%88%E5%88%86%E5%B8%83%E5%BC%8F%E9%94%81/), 实现通用的一个spring boot starter。

## 项目构建
构建完成的项目包结构如下
```
├─src
    ├─main.java.com.noir.common.lock
       │                          ├─annotation    ## 注解
       │                          ├─aop           ## aop切面实现注解支持
       │                          ├─excptions     ## 异常都在这里
       │                          ├─impl       
       │                          │  ├─factorys   ## 锁的工厂实现类
       │                          │  └─locks      ## 锁的实现类
       │                          └─properties    ## 中间件配置的封装
       └─resources
           └─META-INF
```

### starter配置类
配置提供starter发现的META-INF/spring.factories
```
org.springframework.boot.autoconfigure.EnableAutoConfiguration=com.noir.common.LockStarterAutoConfiguration
```

配置类
```java
package com.noir.common;

import com.noir.common.lock.properties.DLockProperties;
import com.noir.common.lock.properties.RedLockProperties;
import com.noir.common.lock.properties.RedisDLockProperties;
import com.noir.common.lock.properties.ZookeeperDLockProperties;
import lombok.extern.slf4j.Slf4j;

import org.apache.zookeeper.Watcher;
import org.apache.zookeeper.ZooKeeper;
import org.redisson.Redisson;
import org.redisson.api.RedissonClient;
import org.redisson.config.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.stream.Collectors;

/**
 * starter配置启动类
 *
 * 扫描了 {@link com.noir.common.lock} 下的
 * 所有类进行初始化，包含aop，对应配置的工程类，
 * 对应中间件配置以及封装使用的service
 *
 * 仅在 {@code locker.enabled=true} 时有效
 *
 * 具体实现参考接口及拓展类
 * @see com.noir.common.lock.DLockFactory
 * @see com.noir.common.lock.LockableService
 * @see com.noir.common.lock.ReentrantDLock
 */
@Slf4j
@Configuration
@ComponentScan("com.noir.common.lock")
@ConditionalOnProperty(prefix = "locker", value = "enabled", havingValue = "true")
@EnableConfigurationProperties({DLockProperties.class, RedisDLockProperties.class, RedLockProperties.class, ZookeeperDLockProperties.class})
public class LockStarterAutoConfiguration {
    @Autowired(required = false)
    private RedisDLockProperties redisDLockProperties;

    @Autowired(required = false)
    private RedLockProperties redLockProperties;

    @Autowired(required = false)
    private ZookeeperDLockProperties zookeeperDLockProperties;

    @Bean
    @ConditionalOnProperty(prefix = "locker", value = "type", havingValue = "redis-expire")
    public RedissonClient redissonEXClient() {
        return createRedissonClient(redisDLockProperties);
    }

    @Bean
    @ConditionalOnProperty(prefix = "locker", value = "type", havingValue = "redis-get-set")
    public RedissonClient redissonGetSetClient() {
        return createRedissonClient(redisDLockProperties);
    }

    @Bean
    @ConditionalOnProperty(prefix = "locker", value = "type", havingValue = "red-lock")
    public List<RedissonClient> redissonRedLockClients() {
        return redLockProperties.getClients().stream().map(this::createRedissonClient).collect(Collectors.toList());
    }

    @Bean
    @ConditionalOnProperty(prefix = "locker", value = "type", havingValue = "zookeeper")
    public ZooKeeper zooKeeper() {
        return createZooKeeper(zookeeperDLockProperties);
    }

    private ZooKeeper createZooKeeper(ZookeeperDLockProperties zookeeperDLockProperties) {
        ZooKeeper zooKeeper = null;
        try {
            final CountDownLatch countDownLatch = new CountDownLatch(1);
            zooKeeper = new ZooKeeper(zookeeperDLockProperties.getAddress(), zookeeperDLockProperties.getTimeout(), event -> {
                if(Watcher.Event.KeeperState.SyncConnected==event.getState()){
                    //如果收到了服务端的响应事件,连接成功
                    countDownLatch.countDown();
                }
            });
            countDownLatch.await();
            log.info("【初始化ZooKeeper连接状态....】={}", zooKeeper.getState());
        } catch (Exception e){
            e.printStackTrace();
            log.error("【初始化ZooKeeper连接异常....】= {}", e.getMessage());
        }
        return zooKeeper;
    }

    private RedissonClient createRedissonClient(RedisDLockProperties redisDLockProperties) {
        switch (redisDLockProperties.getMode()) {
            case "single":
                return redissonSingle(redisDLockProperties);
            case "cluster":
                return redissonCluster(redisDLockProperties);
            case "sentinel":
                return redissonSentinel(redisDLockProperties);
        }
        return null;
    }

    /**
     * 单机模式 redisson 客户端
     */
    private RedissonClient redissonSingle(RedisDLockProperties redisDLockProperties) {
        Config config = new Config();
        String node = redisDLockProperties.getSingle().getAddress();
        node = node.startsWith("redis://") ? node : "redis://" + node;
        SingleServerConfig serverConfig = config.useSingleServer()
                .setAddress(node)
                .setTimeout(redisDLockProperties.getSingle().getConnTimeout())
                .setConnectionPoolSize(redisDLockProperties.getPool().getSize())
                .setConnectionMinimumIdleSize(redisDLockProperties.getPool().getMinIdle());
        if (!StringUtils.isEmpty(redisDLockProperties.getPassword())) {
            serverConfig.setPassword(redisDLockProperties.getPassword());
        }
        return Redisson.create(config);
    }


    /**
     * 集群模式的 redisson 客户端
     */
    private RedissonClient redissonCluster(RedisDLockProperties redisDLockProperties) {
        System.out.println("cluster redisProperties:" + redisDLockProperties.getCluster());

        Config config = new Config();
        String[] nodes = extractRedisAddressByString(redisDLockProperties.getCluster().getNodes());

        ClusterServersConfig serverConfig = config.useClusterServers()
                .addNodeAddress(nodes)
                .setScanInterval(
                        redisDLockProperties.getCluster().getScanInterval())
                .setIdleConnectionTimeout(
                        redisDLockProperties.getPool().getSoTimeout())
                .setConnectTimeout(
                        redisDLockProperties.getPool().getConnTimeout())
                .setFailedAttempts(
                        redisDLockProperties.getCluster().getFailedAttempts())
                .setRetryAttempts(
                        redisDLockProperties.getCluster().getRetryAttempts())
                .setRetryInterval(
                        redisDLockProperties.getCluster().getRetryInterval())
                .setMasterConnectionPoolSize(redisDLockProperties.getCluster()
                        .getMasterConnectionPoolSize())
                .setSlaveConnectionPoolSize(redisDLockProperties.getCluster()
                        .getSlaveConnectionPoolSize())
                .setTimeout(redisDLockProperties.getTimeout());
        if (!StringUtils.isEmpty(redisDLockProperties.getPassword())) {
            serverConfig.setPassword(redisDLockProperties.getPassword());
        }
        return Redisson.create(config);
    }

    /**
     * 哨兵模式 redisson 客户端
     */
    private RedissonClient redissonSentinel(RedisDLockProperties redisDLockProperties) {
        System.out.println("sentinel redisProperties:" + redisDLockProperties.getSentinel());
        Config config = new Config();

        String[] nodes = extractRedisAddressByString(redisDLockProperties.getSentinel().getNodes());

        SentinelServersConfig serverConfig = config.useSentinelServers()
                .addSentinelAddress(nodes)
                .setMasterName(redisDLockProperties.getSentinel().getMaster())
                .setReadMode(ReadMode.SLAVE)
                .setFailedAttempts(redisDLockProperties.getSentinel().getFailMax())
                .setTimeout(redisDLockProperties.getTimeout())
                .setMasterConnectionPoolSize(redisDLockProperties.getPool().getMasterConnectionPoolSize())
                .setSlaveConnectionPoolSize(redisDLockProperties.getPool().getSlaveConnectionPoolSize());

        if (!StringUtils.isEmpty(redisDLockProperties.getPassword())) {
            serverConfig.setPassword(redisDLockProperties.getPassword());
        }

        return Redisson.create(config);
    }

    private String[] extractRedisAddressByString(String nodeStr) {
        String[] nodes = nodeStr.split(",");
        return Arrays.stream(nodes)
                        .map(str -> str.startsWith("redis://") ? str : "redis://" + str)
                        .toArray(String[]::new);
    }
}

```

### 定义接口  

* 提供DLockFactory暴露给外部，实现一定的灵活性
```java
package com.noir.common.lock;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Lock;

/**
 * DLock工厂
 *
 * 提供了DLock的工厂接口，为了更通用并可拓展，
 * 对 {@link ReentrantDLock} 进行了擦除，
 * 在进行具体自定义拓展时，建议继承ReentrantDLock
 * 以实现可重入支持。
 *
 * 具体工厂实现
 * @see com.noir.common.lock.impl.factorys.RedisSetNXExpireLockFactory
 * @see com.noir.common.lock.impl.factorys.RedisSetNXGetSetLockFactory
 * @see com.noir.common.lock.impl.factorys.RedLockFactory
 * @see com.noir.common.lock.impl.factorys.ZookeeperLockFactory
 */
public interface DLockFactory {

    /**
     * 获取锁
     *
     * @param name 锁名称
     * @return 锁对象
     */
    public Lock getLock(String name);

    /**
     * 获取锁
     *
     * @param name 锁名称
     * @param expire 过去时间
     * @param unit 时间单位
     * @return 锁对象
     */
    public Lock getLock(String name, long expire, TimeUnit unit);

}
```

* 提供LockableService作为方便使用Bean接口
```java
package com.noir.common.lock;

import java.util.concurrent.Callable;

/**
 * 具有加锁逻辑的服务接口
 *
 * 提供了lambda表达式的上锁支持，标定锁名称
 * 与对应的Callable或者Runnable即可实现对
 * 块级逻辑的资源锁定，对于多个资源的锁定可以
 * 通过多级嵌套进行实现，同样的，因为默认实现
 * 的工程均实现了可重入接口 {@link ReentrantDLock}
 * 在未使用自定义的DLockFactory时均可重入
 *
 * 具体的实现
 * @see com.noir.common.lock.impl.LockableServiceImpl
 */
public interface LockableService {

    /**
     * 根据key进行加锁, 执行callable任务
     *
     * @param key      加锁的键值
     * @param callable 执行的操作
     * @param <T>      callable任务返回的结果类型
     * @return callable任务返回的结果
     * @throws Exception callable任务执行过程中产生的异常
     */
    <T> T lockAndExecute(String key, Callable<T> callable) throws Exception;

    /**
     * 根据key进行加锁，执行runnable任务
     *
     * @param key      加锁的键值
     * @param runnable 执行的操作
     * @throws Exception runnable任务执行过程中产生的异常
     */
    void lockAndExecute(String key, Runnable runnable) throws Exception;
}
```
* 提供可重入锁的基础类支持
```java
package com.noir.common.lock;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.locks.Lock;

/**
 * 可重入DLock拓展
 *
 * 使用thread local实现锁状态标定，如拓展实现
 * 自定义的锁实现，请务必在解锁后 {@link ReentrantDLock#exit(String)}
 * 以保证状态的清除
 *
 * 提供的四种实现
 * @see com.noir.common.lock.impl.locks.RedLockWrapper
 * @see com.noir.common.lock.impl.locks.RedisSetNXGetSetLock
 * @see com.noir.common.lock.impl.locks.RedisSetNXExpireLock
 * @see com.noir.common.lock.impl.locks.ZookeeperLock
 */
public abstract class ReentrantDLock implements Lock {
    private ThreadLocal<List<String>> localLocks = new ThreadLocal<>();

    protected boolean isEntered(String lockName) {
        List<String> locks = localLocks.get();
        if (Objects.isNull(locks)) {
            return false;
        }
        return locks.contains(lockName);
    }

    protected void enter(String lockName) {
        List<String> locks = localLocks.get();
        if (Objects.isNull(locks)) {
            localLocks.set(new ArrayList<>());
            locks = localLocks.get();
        }
        locks.add(lockName);
    }

    protected void exit(String lockName) {
        List<String> locks = localLocks.get();
        if (Objects.nonNull(locks)) {
            locks.remove(lockName);
        }
    }
}
```

### 实现aop注解支持
* 定义一个注解
```java
package com.noir.common.lock.annotation;

import java.lang.annotation.*;

/**
 * 注解式分布式锁支持
 *
 * 在标定的方法执行结束后将自动释放锁，同样的，
 * 支持可重入意味着可以嵌套使用而不发生死锁。
 *
 * {@code ElementType.ANNOTATION_TYPE}，
 * {@code @Inherited}
 * 这意味着这同样是一个元注解，可以像普通使用
 * Spring annotation一样将多个注解标定到一
 * 个通用的注解上并使用
 * {@link org.springframework.core.annotation.AliasFor}
 * 来指定annotation并将value标定merge进来。
 *
 * {@code ElementType.TYPE}
 * 而对于标定在class上的注解，都将会尝试解析
 * 锁并在其下的方法执行过程中上锁，我认为这不
 * 是一个好方法，对于整体的逻辑和类内部的接口
 * 设计都是一个限制，但我还是提供了，请注意。
 *
 * 同所有Spring AOP标定的注解一样，他可能存
 * 在失效的场景，即内部互相调用时会失去作用，
 * 这会带来额外的心智负担，如果你的团队对于这
 * 些方面并不熟悉，请更多使用
 * {@link com.noir.common.lock.LockableService}
 * or
 * {@link com.noir.common.lock.DLockFactory}
 *
 * 如果还有疑问及迷惑，可以查看具体的aop实现
 * @see com.noir.common.lock.aop.DLockAnnotationAdvice
 * @see com.noir.common.lock.aop.DLockClassAnnotationAdvisor
 * @see com.noir.common.lock.aop.DLockMethodAnnotationAdvisor
 */
@Target({ElementType.METHOD, ElementType.ANNOTATION_TYPE, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Inherited
public @interface DLock {
    String[] value();

    int timeOutSecond() default 30;
}
```

* 对于类上标记注解的切面支持
```java
package com.noir.common.lock.aop;

import com.noir.common.lock.annotation.DLock;
import org.aopalliance.aop.Advice;
import org.springframework.aop.Pointcut;
import org.springframework.aop.support.AbstractPointcutAdvisor;
import org.springframework.aop.support.annotation.AnnotationMatchingPointcut;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 类注解advisor
 *
 * 用于标定类上有 {@link com.noir.common.lock.annotation.DLock}
 * 的切点与对应AnnotationAdvice
 *
 * @see com.noir.common.lock.aop.DLockAnnotationAdvice
 */
@Component
public class DLockClassAnnotationAdvisor extends AbstractPointcutAdvisor {

    @Autowired
    private DLockAnnotationAdvice dLockAnnotationAdvice;

    @Override
    public Pointcut getPointcut() {
        return new AnnotationMatchingPointcut(DLock.class, null, true);
    }

    @Override
    public Advice getAdvice() {
        return dLockAnnotationAdvice;
    }
}
```

* 对于方法上标记注解的切面支持
```java
package com.noir.common.lock.aop;

import com.noir.common.lock.annotation.DLock;
import org.aopalliance.aop.Advice;
import org.springframework.aop.Pointcut;
import org.springframework.aop.support.AbstractPointcutAdvisor;
import org.springframework.aop.support.annotation.AnnotationMatchingPointcut;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * 方法注解advisor
 *
 * 用于标定方法上有 {@link com.noir.common.lock.annotation.DLock}
 * 的切点与对应AnnotationAdvice
 *
 * @see com.noir.common.lock.aop.DLockAnnotationAdvice
 */
@Component
public class DLockMethodAnnotationAdvisor extends AbstractPointcutAdvisor {

    @Autowired
    private DLockAnnotationAdvice dLockAnnotationAdvice;

    @Override
    public Pointcut getPointcut() {
        return new AnnotationMatchingPointcut(null, DLock.class, true);
    }

    @Override
    public Advice getAdvice() {
        return dLockAnnotationAdvice;
    }
}
```

* 具体实现的advice
```java
package com.noir.common.lock.aop;

import com.noir.common.lock.DLockFactory;
import com.noir.common.lock.annotation.DLock;
import com.noir.common.lock.excptions.ErrorParseLockKey;
import com.noir.common.lock.excptions.TryLockFailException;
import org.aopalliance.intercept.MethodInterceptor;
import org.aopalliance.intercept.MethodInvocation;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.context.expression.BeanFactoryResolver;
import org.springframework.core.LocalVariableTableParameterNameDiscoverer;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.ParseException;
import org.springframework.expression.common.TemplateParserContext;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.lang.reflect.Method;
import java.util.LinkedList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.Lock;

/**
 * 具体的注解解析advice
 *
 * 实现拓展了 {@link MethodInterceptor} 以支持
 * 对于方法的上锁增强，通过查找方法及其类上的注解对
 * 相应资源进行上锁或等待。
 *
 * 拓展提供了对方法参数的SpEL解析，可以通过如
 * {@code @DLock("#{#xxx}")} 来获取传入参
 * 数的解析与资源的上锁
 *
 * 资源锁依赖 {@link DLockFactory}来获取实现了
 * {@link Lock} 的实例并对资源进行后续操作，如有
 * 疑惑可看工厂类的接口及其下实现
 * @see com.noir.common.lock.DLockFactory
 */
@Component
public class DLockAnnotationAdvice implements MethodInterceptor {
    @Autowired
    private DLockFactory lockFactory;

    @Autowired
    private ApplicationContext applicationContext;

    // method params discover
    private final LocalVariableTableParameterNameDiscoverer parameterNameDiscoverer = new LocalVariableTableParameterNameDiscoverer();

    @Override
    public Object invoke(MethodInvocation invocation) throws Throwable {
        return doLock(invocation);
    }

    private Object doLock(MethodInvocation invocation) throws Throwable {
        Object[] args = invocation.getArguments();
        Method method = invocation.getMethod();
        Class<?> clz = method.getDeclaringClass();

        DLock dLock = AnnotatedElementUtils.findMergedAnnotation(clz, DLock.class);
        DLock methodDLock = AnnotatedElementUtils.findMergedAnnotation(method, DLock.class);
        if (Objects.nonNull(methodDLock)) {
            dLock = methodDLock;
        }
        assert dLock != null;

        // 创建解析器
        ExpressionParser parser = new SpelExpressionParser();
        // 创建上下文
        StandardEvaluationContext ctx = creteCtx(method, args);

        List<Lock> locks = new LinkedList<>();
        for (String lockResourceEL : dLock.value()) {
            // el parse
            String lockResource = parseKey(parser, ctx, lockResourceEL);
            locks.add(lockFactory.getLock(lockResource));
        }

        try {
            for (Lock lock:locks) {
                if (!lock.tryLock(dLock.timeOutSecond(), TimeUnit.SECONDS)) {
                    throw new TryLockFailException();
                }
            }
            return invocation.proceed();
        } finally {
            for (Lock lock:locks) {
                if (lock != null) {
                    lock.unlock();
                }
            }
        }
    }

    /**
     * SpEL解析
     */
    private String parseKey(ExpressionParser parser, StandardEvaluationContext ctx, String key) throws ErrorParseLockKey {
        if (StringUtils.isEmpty(key)) return "";
        try {
            return parser.parseExpression(key, new TemplateParserContext()).getValue(ctx, String.class);
        } catch (ParseException e) {
            throw new ErrorParseLockKey();
        }
    }

    /**
     * 初始化解析上下文
     */
    private StandardEvaluationContext creteCtx(Method method, Object[] args) {
        String[] paraNameArr = parameterNameDiscoverer.getParameterNames(method);

        //SpEL上下文
        StandardEvaluationContext context = new StandardEvaluationContext();
        //把方法参数放入SpEL上下文中
        if (Objects.nonNull(paraNameArr)) {
            for (int i = 0; i < paraNameArr.length; i++) {
                context.setVariable(paraNameArr[i], args[i]);
            }
        }
        // bean ctx support
        context.setBeanResolver(new BeanFactoryResolver(applicationContext));
        return context;
    }
}
```

### 实现默认实现与相应的配置化
在上面所说的项目结构指定的包中，几种实现更多是基于上篇所述，有兴趣的可以移步至github: [spring-boot-distributed-lock-starter](https://github.com/noir-lattice/spring-boot-distributed-lock-starter)

