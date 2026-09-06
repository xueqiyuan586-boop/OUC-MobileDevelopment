var common = require('../../utils/common.js')

// 频道筛选规则（仅前端使用，不修改 common.js 数据）：
// 第一条为头条要闻；标题含“理论/学术”归学术；
// 标题含“互联网/创新/创业/大赛”归要闻；其余归校园
function getChannel(item, index) {
  if (index === 0) {
    return '要闻'
  }
  if (/理论|学术/.test(item.title)) {
    return '学术'
  }
  if (/互联网|创新|创业|大赛/.test(item.title)) {
    return '要闻'
  }
  return '校园'
}

Page({

  data: {
    // 顶部幻灯片区：3 张本地轮播图，与新闻一一对应
    swiperImg: [
      { src: '/images/newsimage1.jpg', id: '', title: '' },
      { src: '/images/newsimage2.jpg', id: '', title: '' },
      { src: '/images/newsimage3.jpg', id: '', title: '' }
    ],
    swiperCurrent: 0,

    newsList: [],
    displayList: [],
    channels: ['推荐', '要闻', '校园', '学术'],
    stories: [],
    activeChannel: '推荐',

    // 搜索
    searchOpen: false,
    keyword: '',
    isSearching: false,
    searchResults: [],

    // 分享目标（点击某条新闻的分享按钮后记录）
    shareTarget: null,

    // 登录状态：未登录时收藏 / 喜欢 / 分享不可用
    isLogin: false
  },

  onLoad: function (options) {
    this.initNews()
  },

  // 返回首页时刷新登录状态与收藏、点赞标识（与“我的”页操作保持同步）
  onShow: function () {
    if (!this.data.newsList.length) {
      return
    }

    let userInfo = wx.getStorageSync('userInfo')

    this.setData({
      isLogin: !!(userInfo && userInfo.nickName)
    })

    this.refreshFav()

    this.refreshLike()

    if (this.data.isSearching) {
      let kw = this.data.keyword
      this.setData({
        searchResults: this.data.newsList.filter(function (item) {
          return item.title.indexOf(kw) !== -1
        })
      })
    }
  },

  // 下拉刷新
  onPullDownRefresh: function () {
    this.initNews()

    // 短暂保留原生加载动画，作为刷新反馈
    setTimeout(function () {
      wx.stopPullDownRefresh()
    }, 300)
  },

  // 加载新闻并补充前端展示字段
  initNews: function () {
    let list = common.getNewsList()

    // 点赞缓存：likeList 数组（存完整新闻对象，与收藏一致）
    let likeList = wx.getStorageSync('likeList')

    if (!(likeList instanceof Array)) {
      likeList = []
    }

    let likeIds = likeList.map(function (item) {
      return item.id
    })

    let userInfo = wx.getStorageSync('userInfo')

    list.forEach(function (item, i) {
      item.channel = getChannel(item, i)
      item.isFav = !!(wx.getStorageSync(item.id))
      item.liked = likeIds.indexOf(item.id) !== -1

      // 摘要：取新闻正文前段（真实数据，不虚构）
      let result = common.getNewsDetail(item.id)
      item.summary = (result.code == '200' && result.news.content)
        ? result.news.content.trim()
        : ''
    })

    // 轮播图与新闻列表一一对应：补充标题用于展示、id 用于跳转详情
    let swiperImg = this.data.swiperImg
    for (let i = 0; i < swiperImg.length; i++) {
      if (list[i]) {
        swiperImg[i].id = list[i].id
        swiperImg[i].title = list[i].title
      }
    }

    this.setData({
      newsList: list,
      swiperImg: swiperImg,
      isLogin: !!(userInfo && userInfo.nickName)
    })

    this.buildStories()
    this.applyFilter()
  },

  // 构建顶部分类 Stories：圆形头像取对应频道第一条新闻的配图，
  // 没有新闻的频道（如校园）用灰色占位圆
  buildStories: function () {
    let list = this.data.newsList

    let stories = this.data.channels.map(function (name) {
      let img = ''

      if (name === '推荐') {
        img = list.length ? list[0].poster : ''
      } else {
        for (let i = 0; i < list.length; i++) {
          if (list[i].channel === name) {
            img = list[i].poster
            break
          }
        }
      }

      return {
        name: name,
        img: img,
        initial: name.slice(0, 1)
      }
    })

    this.setData({
      stories: stories
    })
  },

  // 按频道过滤。
  // 注意：这里展示全部新闻（3 条），不再用 slice(1) 排除第一条——
  // 之前的 slice(1) 是“首页少显示一条新闻”的根源（头条只进轮播不进列表）。
  applyFilter: function () {
    let ch = this.data.activeChannel
    let list = this.data.newsList

    if (ch !== '推荐') {
      list = list.filter(function (item) {
        return item.channel === ch
      })
    }

    this.setData({
      displayList: list
    })
  },

  // 重新渲染三个列表（对象被原地修改后，同步视图）
  syncLists: function () {
    this.setData({
      newsList: this.data.newsList,
      displayList: this.data.displayList,
      searchResults: this.data.searchResults
    })
  },

  switchChannel: function (e) {
    let ch = e.currentTarget.dataset.channel

    if (ch === this.data.activeChannel) {
      return
    }

    this.setData({
      activeChannel: ch
    })

    this.applyFilter()
  },

  // 登录校验：收藏 / 喜欢 / 分享仅登录后可用，未登录弹提示
  checkLogin: function () {
    let userInfo = wx.getStorageSync('userInfo')

    if (userInfo && userInfo.nickName) {
      return true
    }

    wx.showToast({
      title: '请先登录',
      icon: 'none'
    })

    return false
  },

  // ---------- 点赞（写入“我的喜欢”缓存，未登录不可用） ----------

  toggleLike: function (e) {
    if (!this.checkLogin()) {
      return
    }

    let id = e.currentTarget.dataset.id
    let list = this.data.newsList
    let liked = false

    for (let i = 0; i < list.length; i++) {
      if (list[i].id == id) {
        list[i].liked = !list[i].liked
        liked = list[i].liked
        break
      }
    }

    // 持久化：存完整新闻对象（与收藏一致），供“我的喜欢”页展示
    let likeList = wx.getStorageSync('likeList')

    if (!(likeList instanceof Array)) {
      likeList = []
    }

    if (liked) {
      let exists = false

      for (let i = 0; i < likeList.length; i++) {
        if (likeList[i].id == id) {
          exists = true
          break
        }
      }

      if (!exists) {
        let result = common.getNewsDetail(id)

        if (result.code == '200') {
          likeList.unshift(result.news)
        }
      }
    } else {
      likeList = likeList.filter(function (item) {
        return item.id != id
      })
    }

    wx.setStorageSync('likeList', likeList)
    this.syncLists()
  },

  // ---------- 收藏 / 取消收藏（与详情页同一套本地缓存逻辑） ----------

  toggleFavorite: function (e) {
    if (!this.checkLogin()) {
      return
    }

    let id = e.currentTarget.dataset.id

    if (wx.getStorageSync(id) != '') {
      wx.removeStorageSync(id)
      this.refreshFav()
      wx.showToast({
        title: '已取消收藏',
        icon: 'none'
      })
      return
    }

    // 收藏需存入完整新闻对象（详情页优先读本地缓存）
    let result = common.getNewsDetail(id)

    if (result.code == '200') {
      wx.setStorageSync(id, result.news)
      this.refreshFav()
      wx.showToast({
        title: '已收藏',
        icon: 'success'
      })
    }
  },

  refreshFav: function () {
    let list = this.data.newsList.map(function (item) {
      item.isFav = !!(wx.getStorageSync(item.id))
      return item
    })

    this.setData({
      newsList: list
    })

    this.applyFilter()
  },

  // 重新读取点赞缓存，同步爱心标识
  refreshLike: function () {
    let likeList = wx.getStorageSync('likeList')

    if (!(likeList instanceof Array)) {
      likeList = []
    }

    let likeIds = likeList.map(function (item) {
      return item.id
    })

    let list = this.data.newsList.map(function (item) {
      item.liked = likeIds.indexOf(item.id) !== -1
      return item
    })

    this.setData({
      newsList: list
    })

    this.applyFilter()
  },

  // ---------- 评论 / 更多 ----------

  onComment: function () {
    wx.showToast({
      title: '暂无评论',
      icon: 'none'
    })
  },

  // 右上角 ··· 菜单：复制标题 / 打开详情（均为真实操作）
  onPostMenu: function (e) {
    let id = e.currentTarget.dataset.id
    let title = e.currentTarget.dataset.title

    wx.showActionSheet({
      itemList: ['复制标题', '打开详情'],
      success: function (res) {
        if (res.tapIndex === 0) {
          wx.setClipboardData({
            data: title
          })
        } else if (res.tapIndex === 1) {
          wx.navigateTo({
            url: '../detail/detail?id=' + id
          })
        }
      }
    })
  },

  // ---------- 分享 ----------

  setShareTarget: function (e) {
    if (!this.checkLogin()) {
      return
    }

    this.setData({
      shareTarget: {
        id: e.currentTarget.dataset.id,
        title: e.currentTarget.dataset.title
      }
    })
  },

  onShareAppMessage: function () {
    let target = this.data.shareTarget

    if (target && target.id) {
      return {
        title: target.title,
        path: '/pages/detail/detail?id=' + target.id
      }
    }

    return {
      title: '校园新闻',
      path: '/pages/index/index'
    }
  },

  // ---------- 搜索 ----------

  openSearch: function () {
    this.setData({
      searchOpen: true
    })
  },

  closeSearch: function () {
    this.setData({
      searchOpen: false,
      keyword: '',
      isSearching: false,
      searchResults: []
    })
  },

  // 清空关键词，恢复首页内容
  clearKeyword: function () {
    this.setData({
      keyword: '',
      isSearching: false,
      searchResults: []
    })
  },

  // 实时搜索：按标题匹配
  onSearchInput: function (e) {
    let kw = e.detail.value.trim()

    if (!kw) {
      this.setData({
        keyword: '',
        isSearching: false,
        searchResults: []
      })
      return
    }

    let results = this.data.newsList.filter(function (item) {
      return item.title.indexOf(kw) !== -1
    })

    this.setData({
      keyword: kw,
      isSearching: true,
      searchResults: results
    })
  },


  goToDetail: function (e) {
    let id = e.currentTarget.dataset.id

    if (!id) {
      return
    }

    wx.navigateTo({
      url: '../detail/detail?id=' + id
    })
  },

  // 轮播切换：同步右下角指示点
  onSwiperChange: function (e) {
    this.setData({
      swiperCurrent: e.detail.current
    })
  },

  // 右上角收藏图标：前往“我的”页查看收藏
  goMy: function () {
    wx.switchTab({
      url: '/pages/my/my'
    })
  }

})
