Page({

  data: {

    isLogin: false,

    src: '',

    nickName: '',

    number: 0,

    newsList: [],

    likeList: [],

    historyList: []

  },


  onLoad: function () {

    let userInfo = wx.getStorageSync('userInfo')

    if (userInfo && userInfo.nickName) {

      this.setData({
        isLogin: true,
        src: userInfo.src,
        nickName: userInfo.nickName
      })

      this.getMyFavorites()

      this.getMyLikes()

      this.getHistory()

    }

  },


  // 选择微信头像
  onChooseAvatar: function (e) {

    this.setData({
      src: e.detail.avatarUrl
    })

  },


  // 输入微信昵称
  onNicknameChange: function (e) {

    this.setData({
      nickName: e.detail.value
    })

  },


  login: function () {

    let src = this.data.src
    let nickName = this.data.nickName


    if (!src) {

      wx.showToast({
        title: '请先选择头像',
        icon: 'none'
      })

      return

    }


    if (!nickName) {

      wx.showToast({
        title: '请先设置昵称',
        icon: 'none'
      })

      return

    }


    wx.setStorageSync('userInfo', {
      src: src,
      nickName: nickName
    })


    this.setData({
      isLogin: true
    })


    this.getMyFavorites()

    this.getMyLikes()

    this.getHistory()


    wx.showToast({
      title: '登录成功',
      icon: 'success'
    })

  },


  // 退出登录：只清除登录状态，不删除收藏和浏览历史
  logout: function () {

    let that = this


    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号吗？收藏和浏览记录都会保留。',
      confirmColor: '#E1251B',
      success: function (res) {

        if (res.confirm) {

          wx.removeStorageSync('userInfo')


          that.setData({
            isLogin: false,
            src: '',
            nickName: '',
            number: 0,
            newsList: [],
            likeList: [],
            historyList: []
          })

        }

      }
    })

  },


  // 获取收藏：只识别完整的新闻对象，排除 userInfo、historyList 等缓存
  getMyFavorites: function () {

    if (!this.data.isLogin) {

      this.setData({
        number: 0,
        newsList: []
      })

      return

    }


    let info = wx.getStorageInfoSync()
    let keys = info.keys
    let myList = []


    for (let i = 0; i < keys.length; i++) {

      let obj = wx.getStorageSync(keys[i])


      if (
        obj &&
        obj.id &&
        obj.title &&
        obj.poster
      ) {

        obj.offsetX = 0
        myList.push(obj)

      }

    }


    this.setData({
      newsList: myList,
      number: myList.length
    })

  },


  // 获取浏览历史
  getHistory: function () {

    if (!this.data.isLogin) {

      this.setData({
        historyList: []
      })

      return

    }


    let history = wx.getStorageSync('historyList')


    if (!(history instanceof Array)) {

      history = []

    }


    this.setData({
      historyList: history
    })

  },


  // 获取我的喜欢：读取 likeList 缓存（数组，存完整新闻对象）
  getMyLikes: function () {

    if (!this.data.isLogin) {

      this.setData({
        likeList: []
      })

      return

    }


    let list = wx.getStorageSync('likeList')


    if (!(list instanceof Array)) {

      list = []

    }


    let myList = []


    for (let i = 0; i < list.length; i++) {

      let obj = list[i]


      if (
        obj &&
        obj.id &&
        obj.title &&
        obj.poster
      ) {

        obj.offsetX = 0
        myList.push(obj)

      }

    }


    this.setData({
      likeList: myList
    })

  },


  // 清空浏览历史（弹窗确认）
  clearHistory: function () {

    let that = this


    wx.showModal({
      title: '清空历史',
      content: '确定清空全部浏览足迹吗？',
      confirmColor: '#E1251B',
      success: function (res) {

        if (res.confirm) {

          wx.removeStorageSync('historyList')

          that.getHistory()

        }

      }
    })

  },


  touchStart: function (e) {

    this.startX = e.touches[0].clientX


    // 开始滑动时，收起其它已展开的条目（list 区分收藏 / 喜欢两个列表）
    let index = e.currentTarget.dataset.index
    let listName = e.currentTarget.dataset.list || 'newsList'
    let list = this.data[listName] || []
    let updates = {}


    for (let i = 0; i < list.length; i++) {

      if (i !== index && list[i].offsetX) {
        updates[listName + '[' + i + '].offsetX'] = 0
      }

    }


    if (Object.keys(updates).length) {
      this.setData(updates)
    }

  },


  touchMove: function (e) {

    let index =
      e.currentTarget.dataset.index

    let listName =
      e.currentTarget.dataset.list || 'newsList'

    let currentX =
      e.touches[0].clientX

    let diffX =
      (currentX - this.startX) * 2


    if (diffX < -180) {
      diffX = -180
    }


    if (diffX > 0) {
      diffX = 0
    }


    let key =
      `${listName}[${index}].offsetX`


    this.setData({
      [key]: diffX
    })

  },


  touchEnd: function (e) {

    let index =
      e.currentTarget.dataset.index

    let listName =
      e.currentTarget.dataset.list || 'newsList'

    let offsetX =
      this.data[listName][index].offsetX || 0


    let key =
      `${listName}[${index}].offsetX`


    this.setData({
      [key]:
        offsetX < -80
          ? -180
          : 0
    })

  },


  // 点击红色按钮取消收藏：直接删除并刷新列表
  cancelFavorite: function (e) {

    let id =
      e.currentTarget.dataset.id


    wx.removeStorageSync(id)

    this.getMyFavorites()


    wx.showToast({
      title: '已取消收藏',
      icon: 'none'
    })

  },


  // 点击红色按钮取消喜欢：从 likeList 删除并刷新列表
  cancelLike: function (e) {

    let id =
      e.currentTarget.dataset.id


    let list = wx.getStorageSync('likeList')


    if (!(list instanceof Array)) {

      list = []

    }


    list = list.filter(function (item) {

      return item.id !== id

    })


    wx.setStorageSync('likeList', list)

    this.getMyLikes()


    wx.showToast({
      title: '已取消喜欢',
      icon: 'none'
    })

  },


  goToDetail: function (e) {

    let id =
      e.currentTarget.dataset.id

    let index =
      e.currentTarget.dataset.index

    let listName =
      e.currentTarget.dataset.list || 'newsList'


    if (
      index !== undefined &&
      this.data[listName] &&
      this.data[listName][index] &&
      this.data[listName][index].offsetX < 0
    ) {

      let key =
        `${listName}[${index}].offsetX`

      this.setData({
        [key]: 0
      })

      return

    }


    wx.navigateTo({
      url: '../detail/detail?id=' + id
    })

  },


  goHome: function () {

    wx.switchTab({
      url: '../index/index'
    })

  },


  onShow: function () {

    let userInfo =
      wx.getStorageSync('userInfo')


    if (
      userInfo &&
      userInfo.nickName
    ) {

      this.setData({
        isLogin: true,
        src: userInfo.src,
        nickName: userInfo.nickName
      })


      this.getMyFavorites()

      this.getMyLikes()

      this.getHistory()

    }

    else {

      this.setData({
        isLogin: false,
        src: '',
        nickName: '',
        number: 0,
        newsList: [],
        likeList: [],
        historyList: []
      })

    }

  }

})
