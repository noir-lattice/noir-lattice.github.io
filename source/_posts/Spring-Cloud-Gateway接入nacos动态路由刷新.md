---
title: Spring Cloud Gateway接入nacos动态路由刷新
date: 2020-10-01 20:13:45
tags:
  - Spring
categories: java
---

## 简介
通常在Nacos接入了Spring Cloud的Gateway后还需自定义实现动态的路由配置来提供后续更为灵活的接口发布与维护，这里主要记录实现步骤。

## 配置
指定路由配置文件，用于启动时创建Nacos Config文件监听  
```java
@Data
@Configuration
@ConfigurationProperties(prefix = "dynamic-config")
public class DynamicRoutingFileProperties {

    /**
     * 配置文件id
     */
    private String dataId;

    /**
     * 配置分组
     */
    private String groupId;

    private Long timeout = 3000L;

}
```

## 具体实现
* DynamicRouteServiceImpl
    ```java
    /**
    * 动态路由服务实现
    *
    * 具体的路由信息变更刷新，因监听文件更新仅可拿到全量的路由配置，
    * 为了减轻整体逻辑负担，使用merge逻辑更新definition并发出变
    * 更通知。
    *
    * 虽然仅变更不通知，可以简易的通过全量删除并全量添加即可实现路由
    * 更新，但并不保证后续是否存在对历史definition对象的引用，故此
    * 处使用更保险的策略。
    *
    * 又因为merge策略，可能导致对部分definition更新后会影响默认的
    * order,所以在添加注册时会填充未标记的order。
    */
    @Slf4j
    @Component
    public class DynamicRouteServiceImpl implements ApplicationEventPublisherAware {

        @Autowired
        private RouteDefinitionRepository routeDefinitionRepository;

        private ApplicationEventPublisher publisher;

        /**
        * merge更新路由
        *
        * 保证刷新逻辑不存在线程安全问题，刷新路由并没有很高的性能需求，此处锁住整个refresh方法。
        * @param definitions 路由详情集合
        */
        public synchronized void refresh(List<RouteDefinition> definitions) {
            // 填充生成order
            fillTargetRouteOrder(definitions);
            // 目标routes id集合
            List<String> targetDefIds = definitions.stream().map(RouteDefinition::getId).collect(Collectors.toList());
            // 获取现存所有路由map
            Map<String, RouteDefinition> aliveRouteMap = getAliveRouteMap();
            // 删除失效的routes
            removeDefinitions(targetDefIds, aliveRouteMap);
            // 更新definitions
            updateDefinitions(definitions, aliveRouteMap);
            // 添加definitions
            createDefinitions(definitions, aliveRouteMap);
            // 发布路由已更新时间
            publishRouteChangedEvent();
        }

        /**
        * 填充目标路由order
        *
        * @param definitions 路由详情集合
        */
        private void fillTargetRouteOrder(List<RouteDefinition> definitions) {
            int order = 1;
            for (RouteDefinition route : definitions) {
                if (route.getOrder() == 0) {
                    route.setOrder(order++);
                }
            }
        }

        /**
        * 发布路由已更新消息
        */
        private void publishRouteChangedEvent() {
            this.publisher.publishEvent(new RefreshRoutesEvent(this));
        }

        /**
        * 添加routes
        *
        * @param definitions 目标routes
        * @param aliveRouteMap 当前存活路由map
        */
        private void createDefinitions(List<RouteDefinition> definitions, Map<String, RouteDefinition> aliveRouteMap) {
            // 获取新添加的definitions
            Set<String> aliveRouteIdSet = aliveRouteMap.keySet();
            List<RouteDefinition> needCreateDefs =
                    definitions
                            .stream()
                            .filter(route -> !aliveRouteIdSet.contains(route.getId()))  // 不存在与当前存活集合
                            .collect(Collectors.toList());
            doCreateDefinitions(needCreateDefs);
        }

        /**
        * 执行添加路由
        *
        * @param needCreateDefs 需要新增的路由集合
        */
        private void doCreateDefinitions(List<RouteDefinition> needCreateDefs) {
            needCreateDefs.forEach(createDef -> {
                try {
                    this.routeDefinitionRepository.save(Mono.just(createDef)).subscribe();
                    log.info("created route: {}", createDef.getId());
                } catch (Exception e) {
                    e.printStackTrace();
                    log.info("create route {} fail", createDef.getId());
                }
            });
        }

        /**
        * 更新路由
        *
        * @param definitions 目标routes
        * @param aliveRouteMap 当前存活路由map
        */
        private void updateDefinitions(List<RouteDefinition> definitions, Map<String, RouteDefinition> aliveRouteMap) {
            Set<String> aliveRouteIdSet = aliveRouteMap.keySet();
            List<RouteDefinition> needUpdateDefs =
                    definitions
                            .stream()
                            .filter(route -> aliveRouteIdSet.contains(route.getId())
                                    && !route.equals(aliveRouteMap.get(route.getId())))  // 当前存活且与当前definition不同则为更新
                            .collect(Collectors.toList());
            doUpdateDefinitions(needUpdateDefs);
        }

        /**
        * 删除并重新创建路由实现更新
        *
        * route repo无updater的结局方法
        * @param needUpdateDefs 需要更新route集合
        */
        private void doUpdateDefinitions(List<RouteDefinition> needUpdateDefs) {
            needUpdateDefs.forEach(updateDefinition -> {
                try {
                    this.routeDefinitionRepository
                            .delete(Mono.just(updateDefinition.getId()))
                            .subscribe();
                    log.info("removed old route(will be recreate): {}", updateDefinition.getId());
                } catch (Exception e) {
                    e.printStackTrace();
                    log.info("can't clean route(will be create): {}", updateDefinition.getId());
                }
                try {
                    this.routeDefinitionRepository.save(Mono.just(updateDefinition)).subscribe();
                    log.info("updated route: {}", updateDefinition.getId());
                } catch (Exception e) {
                    e.printStackTrace();
                    log.info("updated route {} fail", updateDefinition.getId());
                }
            });
        }

        /**
        * 获取当前存活的路由描述map
        *
        * @return 当前存活的路由描述map
        */
        private Map<String, RouteDefinition> getAliveRouteMap() {
            return routeDefinitionRepository
                    .getRouteDefinitions()
                    .toStream()
                    .collect(Collectors.toMap(RouteDefinition::getId, Function.identity()));
        }

        /**
        * 删除剔除的routes
        *
        * @param targetDefIds 目标route id集合
        * @param aliveRouteMap 当前存活的路由map
        */
        private void removeDefinitions(List<String> targetDefIds, Map<String, RouteDefinition> aliveRouteMap) {
            List<String> removedDefinitionIds =
                    aliveRouteMap
                            .keySet()
                            .stream()
                            .filter(routeId -> !targetDefIds.contains(routeId)) // 不存在于目标id集合判定为删除
                            .collect(Collectors.toList());
            doRemoveDefinitions(removedDefinitionIds);
        }

        /**
        * 删除剔除的routes
        *
        * @param removedDefinitionIds 需要被剔除的route id集合
        */
        private void doRemoveDefinitions(List<String> removedDefinitionIds) {
            removedDefinitionIds.forEach(removedId -> {
                this.routeDefinitionRepository
                        .delete(Mono.just(removedId))
                        .subscribe();
                log.info("removed route: {}", removedId);
            });
        }


        /**
        * 开启监听
        *
        * @param applicationEventPublisher publisher instance
        */
        @Override
        public void setApplicationEventPublisher(ApplicationEventPublisher applicationEventPublisher) {
            this.publisher = applicationEventPublisher;
        }
    }
    ```  
* DynamicRouteServiceListener
    ```java
    /**
    * 动态路由监听
    *
    * 添加对对应配置文件更新时的监听，实现动态路由刷新。一般的，为了保证
    * 仅在启动时注册指定的对应文件（通常这个文件也是动态配置，这里暂时没
    * 有实现当更换路由配置文件时的刷新）更新时对正在运行的路由信息进行刷
    * 新。
    *
    * 该类主要实现yaml解析，并构建definition对象，对于具体的刷新逻辑
    * @see DynamicRouteServiceImpl
    */
    @Slf4j
    @Component
    @RefreshScope
    public class DynamicRouteServiceListener implements CommandLineRunner {

        @Autowired
        private DynamicRouteServiceImpl dynamicRouteService;

        @Autowired
        NacosConfigManager nacosConfigManager;

        @Autowired
        private DynamicRoutingFileProperties dynamicRoutingFileProperties;

        /**
        * 添加配置文件更新监听
        */
        private void dynamicRouteListener () {
            try {
                ConfigService configService = nacosConfigManager.getConfigService();
                // first process ed add listener
                processConfigInfo(configService.getConfigAndSignListener(
                        dynamicRoutingFileProperties.getDataId(),
                        dynamicRoutingFileProperties.getGroupId(),
                        dynamicRoutingFileProperties.getTimeout(),
                        new Listener()  {
                            @Override
                            public void receiveConfigInfo(String configInfo) {
                                processConfigInfo(configInfo);
                            }

                            @Override
                            public Executor getExecutor() {
                                return null;
                            }
                        }
                ));
            } catch (NacosException e) {
                log.error("add config listener fail !!!");
                e.printStackTrace();
            }
        }

        /**
        * 处理配置信息
        *
        * @param configInfo 配置string
        */
        private void processConfigInfo(String configInfo) {
            if (Objects.isNull(configInfo)) return;
            // 解析yaml文件获取路由定义
            List<RouteDefinition> targetRouteDefinitions = getRouteDefinitionsByYaml(configInfo);
            // 更新路由信息
            dynamicRouteService.refresh(targetRouteDefinitions);
        }

        /**
        * 通过yaml str解析出route定义
        *
        * @param configInfo yaml str
        * @return RouteDefinition array
        */
        private List<RouteDefinition> getRouteDefinitionsByYaml(String configInfo) {
            Yaml yaml = new Yaml();
            Map<Object, Object> document = yaml.load(configInfo);
            List<Map<String, Object>> routeList = (List<Map<String, Object>>) document.get("routes");
            List<RouteDefinition> targetRouteDefinitions = new ArrayList<>(routeList.size());
            for (Map<String, Object> routeItem : routeList) {
                RouteDefinition routeDefinition = new RouteDefinition();
                routeDefinition.setId((String) routeItem.get("id"));
                routeDefinition.setUri(URI.create((String) routeItem.get("uri")));
                List<String> predicateStrList = (List<String>) routeItem.get("predicates");
                List<PredicateDefinition> predicateDefinitions = predicateStrList.stream().map(PredicateDefinition::new).collect(Collectors.toList());
                routeDefinition.setPredicates(predicateDefinitions);
                List<String> filterStrList = (List<String>) routeItem.get("filters");
                if (CollectionUtils.isNotEmpty(filterStrList)) {
                    List<FilterDefinition> filterDefinitions = filterStrList.stream().map(FilterDefinition::new).collect(Collectors.toList());
                    routeDefinition.setFilters(filterDefinitions);
                }
                Object orderObj = routeItem.get("order");
                int order = Objects.isNull(orderObj) ? 0 : (int) orderObj;
                routeDefinition.setOrder(order);
                targetRouteDefinitions.add(routeDefinition);
            }

            return targetRouteDefinitions;
        }

        @Override
        public void run(String... args) {
            Long startTime = System.currentTimeMillis();
            dynamicRouteListener();
            Long completeTime = System.currentTimeMillis();
            log.info("dynamic router cost {}ms to initialization routes and registered configurer.", completeTime - startTime);
        }
    }
    ```
## 配置与填序
```yaml
routes:
  - id: crmCampusModule
    uri: lb://campus
    predicates:
      - Path=/campus/crm/**
```
uri使用lb走的是SCA的nacos naming，后面跟服务名称就好了，具体还有一个order参数，是用来标识路由顺序的，默认做了列表的填序，如果自己配置了order的话还是以自定义的order为主。