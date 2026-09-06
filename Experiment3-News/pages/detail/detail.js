var common = require('../../utils/common.js')

Page({

  data: {

    article: {},

    isAdd: false,

    prevNews: null,

    nextNews: null

  },


  onLoad: function (options) {

    this.loadArticle(options.id)

  },


  // 加载新闻：优先取本地收藏缓存，否则取新闻数据
  loadArticle: function (id) {

    let newArticle =
      wx.getStorageSync(id)

    let article = null


    // 已收藏
    if (newArticle != '') {

      article = newArticle

    }

    // 未收藏
    else {

      let result =
        common.getNewsDetail(id)


      if (result.code == '200') {

        article = result.news

      }

    }


    if (!article) {

      return

    }


    this.setData({

      article: article,

      isAdd: newArticle != ''

    })


    this.updatePager(id)

    this.saveHistory(article)

  },


  // 上一篇 / 下一篇：根据新闻列表定位当前 id
  updatePager: function (id) {

    let list = common.getNewsList()

    let index = -1


    for (let i = 0; i < list.length; i++) {

      if (list[i].id == id) {

        index = i

        break

      }

    }


    this.setData({

      prevNews: index > 0 ? list[index - 1] : null,

      nextNews: index > -1 && index < list.length - 1 ? list[index + 1] : null

    })

  },


  // 浏览历史：去重后插到最前，最多保留 20 条
  saveHistory: function (article) {

    let history =
      wx.getStorageSync('historyList')


    if (!(history instanceof Array)) {

      history = []

    }


    history = history.filter(function (item) {

      return item && item.id != article.id

    })


    history.unshift(article)


    if (history.length > 20) {

      history = history.slice(0, 20)

    }


    wx.setStorageSync('historyList', history)

  },


  // 登录校验：未登录不能收藏（提示请先登录）
  checkLogin: function () {

    let userInfo =
      wx.getStorageSync('userInfo')


    if (
      userInfo &&
      userInfo.nickName
    ) {

      return true

    }


    wx.showToast({

      title: '请先登录',

      icon: 'none'

    })


    return false

  },


  // 收藏（未登录不可用，与首页一致）
  addFavorites: function () {

    if (!this.checkLogin()) {

      return

    }


    let article =
      this.data.article


    wx.setStorageSync(

      article.id,

      article

    )


    this.setData({

      isAdd: true

    })


    wx.showToast({

      title: '已收藏',

      icon: 'success'

    })

  },


  // 取消收藏（未登录不可用，与首页一致）
  cancelFavorites: function () {

    if (!this.checkLogin()) {

      return

    }


    let article =
      this.data.article


    wx.removeStorageSync(

      article.id

    )


    this.setData({

      isAdd: false

    })


    wx.showToast({

      title: '已取消收藏',

      icon: 'none'

    })

  },


  // 返回首页（tabBar 页面）
  goHome: function () {

    wx.switchTab({

      url: '/pages/index/index'

    })

  },


  goPrev: function () {

    if (!this.data.prevNews) {

      return

    }


    wx.redirectTo({

      url: '../detail/detail?id=' + this.data.prevNews.id

    })

  },


  goNext: function () {

    if (!this.data.nextNews) {

      return

    }


    wx.redirectTo({

      url: '../detail/detail?id=' + this.data.nextNews.id

    })

  },


  // 转发：把当前新闻分享给好友（真实转发功能）
  onShareAppMessage: function () {

    let article = this.data.article


    if (article && article.id) {

      return {
        title: article.title,
        path: '/pages/detail/detail?id=' + article.id
      }

    }


    return {
      title: '校园新闻',
      path: '/pages/index/index'
    }

  }

})
