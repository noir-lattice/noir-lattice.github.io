---
title: '从代码到线上,高度集成的gitlab工具链(三): Gitpage'
date: 2019-10-24 15:02:57
tags:
  - gitlab
categories: devops
---

## 概述
  就像github一样，gitlab一样提供了托管静态站点的能力，结合GitLab CI的力量和GitLab Runner的帮助，你可以为你的单独项目、用户或组部署静态页面。

## 开启Gitlab page
  你需要一个域名解析或者让组员们自己改hosts，当然，多个静态站要添加很多条记录，而自己搭建个name服务器支持泛域名解析可能是更加科学的办法。

## 泛域名配置
  * 修改/etc/gitlab/gitlab.rb文件
  ```ruby
  pages_external_url 'http://example.io'
  ```
  * 拉起gitlab配置
  ```bash
  sudo gitlab-ctl reconfigure
  ```

## 创建一个page项目
  首先，要知道名称是跟着用户名或者组名走的，如下图
  ![Commit](projectname.png)

  然后写咱们的.gitlab-ci.yml
```yaml
# requiring the environment of NodeJS 10
image: node:10

# add 'node_modules' to cache for speeding up builds
cache:
  paths:
    - node_modules/ # Node modules and dependencies

before_script:
  - npm install gitbook-cli -g # install gitbook
  - gitbook fetch 3.2.3 # fetch final stable version
  - gitbook install # add any requested plugins in book.json

test:
  stage: test
  script:
    - gitbook build . public # build to public path
  only:
    - branches # this job will affect every branch except 'master'
  except:
    - master
    
# the 'pages' job will deploy and build your site to the 'public' path
pages:
  stage: deploy
  script:
    - gitbook build . public # build to public path
  artifacts:
    paths:
      - public
    expire_in: 1 week
  only:
    - master # this job will affect only the 'master' branch

```  

添加目录文件SUMMARY.md

```
# Summary

* [Introduction](README.md)
```

添加内容文件README.md

```
## hello gitpage
```
这里使用gitbook来作为page范例，更多可参考[Gitlab page examples](https://gitlab.com/pages)

## 等待pipeline
在提交以上内容后，gitlab会根据ci文件内定义的job开始pipeline（需要创建gitlab runner, 创建与注册runner在[从代码到线上,高度集成的gitlab工具链(一): CI/CD](https://noir-lattice.github.io/2019/08/28/%E4%BB%8E%E4%BB%A3%E7%A0%81%E5%88%B0%E7%BA%BF%E4%B8%8A-%E9%AB%98%E5%BA%A6%E9%9B%86%E6%88%90%E7%9A%84gitlab%E5%B7%A5%E5%85%B7%E9%93%BE-%E4%B8%80-%E5%B7%A5%E5%85%B7%E9%93%BE%E4%BB%8B%E7%BB%8D%E5%8F%8A%E7%8E%AF%E5%A2%83%E6%90%AD%E5%BB%BA/)），在等待job完成后咱们就可以在对应的web地址访问了。