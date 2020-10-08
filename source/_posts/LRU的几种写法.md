---
title: LRU的几种写法
date: 2020-10-08 17:02:24
tags:
  - LRU
categories: 算法与数据结构
---

## 简介
LRU （Least Recently Used，最近最少使用）算法是操作系统中一种经典的页面置换算法，这么卷的环境下肯定要会手写拉，这篇就是讲茴字的几种写法。

## 双向链表
简单来说就一个链表，左端入，清理最右，插入与查询都是O(n)

```java
public class LinkListLRUCache {

    /**
     * 双端链表
     */
    private LinkedList<Node> cache;

    /**
     * cache大小
     */
    private int capacity;

    public LRUCache(int capacity) {
        this.cache = new LinkedList<>();
        this.capacity = capacity;
    }

    /**
     * 获取命中index
     * 
     * @return -1 为找不到
     */
    public int get(int key) {
        Iterator<Node> iterator = cache.descendingIterator();
        int result = -1;
        while (iterator.hasNext()) {
            Node node = iterator.next();
            if (node.key == key) {
                result = node.val;
                iterator.remove(); // remove node
                put(key, result); // reput node
                break;
            }
        }
        return result;
    }

    public void put(int key, int value) {
        // 尝试命中已存在并删除对应node
        Iterator<Node> iterator = cache.iterator();
        while (iterator.hasNext()) {
            Node node = iterator.next();
            if (node.key == key) {
                iterator.remove();
                break;
            }
        }

        if (capacity == cache.size()) {
            // 缓存满，删除链表头
            cache.removeFirst();
        }
        cache.add(new Node(key, value));
    }


    class Node {
        int key;
        int val;

        public Node(int key, int val) {
            this.key = key;
            this.val = val;
        }
    }
}
```

## 哈希链表
用LinkedHashMap代替LinkedList，插入与查询都是O(1)

```java
public class HashLinkListLRUCache {
  
  /**
   * 哈希链表
   */
  private LinkedHashMap<Integer, Integer> cache;


  /**
   * 缓存容量
   */
  private int capacity;

  public HashLinkListLRUCache(int capacity) {
    this.cache = new LinkedHashMap<>();
    this.capacity = capacity;
  }

  /**
   * 获取命中index
   * 
   * @return -1 为找不到
   */
  public int get(int key) {
    if (!cache.containsKey(key)) return -1;

    int val = cache.get(key);
    cache.remove(key);
    cache.put(key, val);
    return val;
  }

  public void put(int key, int value) {
    if (cache.containsKey(key)) {
      cache.remove(key);
    }

    if (capacity == cache.size()) {
      Set<Integer> keySet = cache.keySet();
      Iterator<Integer> iterator = keySet.iterator();
      cache.remove(iterator.next());
    }

    cache.put(key, value);
  }

}
```  

当然，也可以重写LinkedHashMap#removeEldestEntry(Map.Entry)
```java
import java.util.LinkedHashMap;
import java.util.Map;

public class HashLinkListLRUCache {
  
  /**
   * 哈希链表
   */
  private Map<Integer, Integer> cache;

  public HashLinkListLRUCache(int capacity) {
    this.cache = new LinkedHashMap<>() {
      private static final long serialVersionUID = 1L;

      @Override
      protected boolean removeEldestEntry(java.util.Map.Entry<Integer, Integer> eldest) {
        return size() > capacity;
      }
    };
  }

  /**
   * 获取命中index
   * 
   * @return -1 为找不到
   */
  public int get(int key) {
    if (!cache.containsKey(key)) return -1;

    int val = cache.get(key);
    cache.remove(key);
    cache.put(key, val);
    return val;
  }

  public void put(int key, int value) {
    if (cache.containsKey(key)) {
      cache.remove(key);
    }

    cache.put(key, value);
  }

}
```

## 通用一点
改的给阳间一点：
```java
public class LRUCache<K, V> extends LinkedHashMap<K, V> {

  private static final long serialVersionUID = 1L;

  /**
   * cache容器大小
   */
  private int capacity;

  /**
   * 初始化cache大小
   * 
   * @param capacity cache大小
   */
  public LRUCache(int capacity) {
    super(capacity);
    this.capacity = capacity;
  }

  @Override
  protected boolean removeEldestEntry(Map.Entry<K,V> eldest) {
    return size() > capacity;
  }

}
```
