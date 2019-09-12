---
title: '从代码到线上,高度集成的gitlab工具链(二): gitflow'
date: 2019-09-12 10:46:27
tags:
  - gitflow
  - gitlab
categories: devops
---

## 从git到gitflow到gitlab的gitflow
  git作为一个分布式的版本管理软件拥有优秀的分支模型支持，而基于模型与长期实践中获得的版本管理工作流程就叫gitflow，而gitlab则为日常开发工作提供了gitflow的系列可视化工具链。

  <!--more-->

## 总结和实践一个分支模型
  对于不同大小的公司有不同的管理办法，形而上学的完美解决方案是不存在的，公司人员协调与事物规章甚至问题追责办法对于不同规模不同性质的机构实体都有不同的处理办法，对于软件项目的分支模型设计同样是这个道理。  

  一个简单的道理，如果是个人项目，不需要协调与管理、需求明确、任务时间自由且设计思路清晰，那么我肯定不会建出五花八门的分支用于消磨自己的时间；而对于项目与人员都很复杂，模块需要负责人员并提供好过程与质量管理，那么我们肯定需要根据实际情况创建不同的分支来进行管理来维护开发进程的稳定。 

  常见的，我们可能会创建的分支有：
  * master: 主分支，仅做对外发布作用，只读（仅可通过release/hotfix合并）
  * develop: 开发分支，从develop签出，只读（仅可通过feature/release合并）
  * feature: 特性分支，临时分支，可以有多个，从develop签出，在release提测后可删除
  * release: 测试分支，临时分支，从某个feature分支中签出，提交测试功能完成后合并至develop/master完成发布后可删除
  * hotfix: 紧急修复分支，临时分支，从master签出，修复bug后合并至develop/master完成发布

### Commit graph
  ![Commit graph](git-model@2x.png)
  在该模型中，值得注意的是：
  * master的每次merge都是合并的一次提交并打标（做发布的版本控制）
  * 严格的只读保护master和develop（代码保护）
  * feature需要在release中提测过才可以合并发布（ci/cd及管理友好）

以上我们举了较为通用的gitflow分支模型，在配合相应的人员管理与需求工具集成便可以方便而有序的维持项目开发过程。

## gitlab提供的工具
  * 提交视图
  ![Commit](commit.png)
  * 分支管理
  ![branche](branche.png)
  * 标记管理
  ![tags](tags.png)
  * 分支视图
  ![graph](graph.png)

## 值得推荐的工具与参考
  * [gitflow extensions](http://danielkummer.github.io/git-flow-cheatsheet/)
  * [A successful Git branching model](https://nvie.com/posts/a-successful-git-branching-model/)