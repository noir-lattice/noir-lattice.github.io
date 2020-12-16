---
title: mybatis update返回值问题
date: 2020-12-16 09:37:13
tags:
  - mybatis
categories: 踩坑记录
---



## 问题

对于一条下面的update返回的这个int是什么？

```java
public interface SomeMapper {
  
  @Update("some update sql")
  int updateById(Long id);
  
}
```



Orical返回的是更新影响行数（正常人都可以理解的正常逻辑语义！！！）



MySQL返回更新语句中查询命中行数（？？？？？？？？？？？？？）

如果关了更新统计，返回的是-1（？！？！？！？！？！？！）



如果你是用mysql，需要在连接属性上加上useAffectedRows才是更新影响行数（微笑😊

