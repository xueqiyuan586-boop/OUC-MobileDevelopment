//引用公共存储工具（管理玩家信息、关卡进度、游戏设置与新手教程）
var storage = require('../../utils/storage.js')

//本次会话是否已经自动弹过登录框（首次进入且未登录时自动弹出一次）
var loginPrompted = false

//选关地图上四个关卡小岛的位置（相对地图容器的百分比，自下而上呈Z型冒险路线）
var NODE_POS = [
  { x: 64, y: 82 },   //第1关：右下 起点冰台
  { x: 31, y: 63 },   //第2关：左下偏中 浮冰平台
  { x: 67, y: 44 },   //第3关：右上偏中 危险雪地平台
  { x: 34, y: 24 }    //第4关：左上 终点平台
]

//小鸟相对推荐关卡的站位偏移（百分比，站在平台旁的雪地上、脚下有阴影，随节点位置动态计算）
//x=±24%即±180rpx：鸟身内沿距平台边缘30rpx；y=7%即78rpx：鸟脚落在平台底沿下方的雪地上
var BIRD_OFFSET = [
  { x: 24, y: 7 },    //第1关：站在平台右下方
  { x: 24, y: 7 },    //第2关：站在平台右下方
  { x: 24, y: 7 },    //第3关：站在平台右下方
  { x: -24, y: 7 }    //第4关：右侧已有终点小猪，改站平台左下方避免重叠
]

//旧版Emoji头像到图片的映射（兼容已保存的玩家数据，展示时统一用游戏图片）
var AVATAR_MAP = {
  '🐦': '/images/icons/bird.png',
  '🐷': '/images/icons/pig.png',
  '📦': '/images/icons/box.png',
  '🧸': '/images/icons/ice.png'
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    //选关地图节点（由refresh()根据进度生成：位置/锁定/当前/星级）
    nodes: [],
    //玩家信息（未登录时为null）
    user: null,
    //玩家展示头像（微信头像文件优先，其次旧Emoji映射图片，游客为空）
    avatarImg: '',
    //玩家称号（随总星数升级的展示文案）
    playerTitle: '',
    //冒险进度
    progressText: '已通过 0 / 4 关',
    progressShort: '0/4',
    progressPercent: 0,
    totalStars: 0,
    //小鸟位置（相对地图容器的百分比，refresh()按当前推荐关卡动态计算）
    birdPos: { x: 88, y: 89 },
    //弹层开关
    showPlayer: false,
    showLogin: false,
    showHelp: false,
    showScores: false,
    showSettings: false,
    //登录表单
    nickInput: '',
    avatarIndex: 0,
    //选择的微信头像临时路径（chooseAvatar返回，登录时复制到用户目录）
    loginAvatarPath: '',
    //头像选择器状态锁：打开期间禁用按钮，防止快速连点触发重复拉起
    choosingAvatar: false,
    //可选冒险形象（emoji为存储值，img为展示图片，兼容旧版Emoji数据）
    avatars: [
      { emoji: '🐦', img: '/images/icons/bird.png' },
      { emoji: '🐷', img: '/images/icons/pig.png' },
      { emoji: '📦', img: '/images/icons/box.png' },
      { emoji: '🧸', img: '/images/icons/ice.png' }
    ],
    //游戏设置（来自本地存储）
    soundEnabled: true,
    vibrateEnabled: true,
    tipsEnabled: true
  },

  /**
   * 生命周期函数--监听页面卸载（清除头像选择锁的兜底计时器）
   */
  onUnload: function () {
    clearTimeout(this.avatarUnlockTimer)
  },

  /**
   * 生命周期函数--监听页面显示（从游戏页返回时刷新进度）
   */
  onShow: function () {
    this.refresh()
    //第一次进入且未登录时，自动弹出登录框（获取微信昵称头像）
    if (!loginPrompted && !storage.getUser()) {
      loginPrompted = true
      this.setData({
        showLogin: true
      })
    }
  },

  /**
   * 自定义函数--刷新玩家信息、选关地图节点与游戏设置
   */
  refresh: function () {
    var user = storage.getUser()
    var progress = storage.getLevelProgress()
    var settings = storage.getSettings()
    var levelNames = ['初次挑战', '小试身手', '动动脑筋', '最终挑战']
    var tags = ['入门', '简单', '进阶', '困难']
    var completedCount = 0
    var totalStars = 0
    var firstIncomplete = 0
    //组装选关地图节点：locked表示需先通过上一关，current表示当前挑战关卡
    var nodes = NODE_POS.map(function (pos, i) {
      var lv = i + 1
      var res = progress[lv] || null
      var done = !!(res && res.completed)
      //已通关的关卡永不锁定（兼容旧版本通关记录：记录key与关卡编号一致，防止出现“已通关却带锁”）；
      //未通关关卡需先通过上一关
      var locked = i > 0 && !done && !(progress[i] && progress[i].completed)
      if (done) {
        completedCount++
        totalStars += res.stars || 0
      } else if (!firstIncomplete) {
        firstIncomplete = lv
      }
      return {
        level: lv,
        x: pos.x,
        y: pos.y,
        name: levelNames[i],
        tag: tags[i],
        locked: locked,
        done: done,
        current: false,
        stars: res ? res.stars : 0,
        bestSteps: res ? res.bestSteps : 0
      }
    })
    //当前挑战关卡：第一个未通关的关卡带呼吸高亮；全部通关则不再高亮
    if (firstIncomplete) {
      nodes[firstIncomplete - 1].current = true
    }
    //小鸟跟随当前推荐关卡：站在第一个未通关的关卡旁；全部通关后停在最后一关旁
    var birdIndex = firstIncomplete ? firstIncomplete - 1 : 3
    var birdPos = {
      x: NODE_POS[birdIndex].x + BIRD_OFFSET[birdIndex].x,
      y: NODE_POS[birdIndex].y + BIRD_OFFSET[birdIndex].y
    }
    //玩家称号：随总星数升级（游客显示登录提示文案）
    var playerTitle = '点击登录开始冒险'
    if (user) {
      if (totalStars >= 9) {
        playerTitle = '冰原大师'
      } else if (totalStars >= 5) {
        playerTitle = '冰晶探险家'
      } else if (totalStars >= 1) {
        playerTitle = '冰川行者'
      } else {
        playerTitle = '冰雪见习生'
      }
    }
    //玩家展示头像：微信头像文件优先，其次旧Emoji映射图片，游客无头像
    var avatarImg = ''
    if (user) {
      avatarImg = user.avatarPath || AVATAR_MAP[user.avatar] || ''
    }
    this.setData({
      user: user,
      avatarImg: avatarImg,
      playerTitle: playerTitle,
      nodes: nodes,
      progressText: '已通过 ' + completedCount + ' / 4 关',
      progressShort: completedCount + '/4',
      progressPercent: completedCount * 25,
      totalStars: totalStars,
      birdPos: birdPos,
      soundEnabled: settings.soundEnabled,
      vibrateEnabled: settings.vibrateEnabled,
      tipsEnabled: settings.tipsEnabled
    })
  },

  /**
   * 自定义函数--游戏选关（锁定关卡提示先过上一关）
   */
  chooseLevel: function (e) {
    //读取当前点击的关卡编号
    var level = e.currentTarget.dataset.level
    //锁定关卡：需先通过上一关
    for (var i = 0; i < this.data.nodes.length; i++) {
      if (this.data.nodes[i].level === level && this.data.nodes[i].locked) {
        wx.showToast({
          title: '先通过上一关才能解锁',
          icon: 'none'
        })
        return
      }
    }
    //未登录时提示先登录，登录后才能开始挑战
    if (!storage.getUser()) {
      var that = this
      wx.showModal({
        title: '请先登录',
        content: '登录后即可开始挑战，通关进度会保存在本机',
        cancelText: '取消',
        confirmText: '去登录',
        confirmColor: '#FF8E3C',
        success: function (res) {
          if (res.confirm) {
            that.openLogin()
          }
        }
      })
      return
    }
    //携带关卡参数跳转到game页面
    wx.navigateTo({
      url: '../game/game?level=' + level
    })
  },

  /**
   * 自定义函数--打开/关闭玩家中心弹层
   */
  openPlayer: function () {
    this.setData({
      showPlayer: true
    })
  },
  closePlayer: function () {
    this.setData({
      showPlayer: false
    })
  },

  /**
   * 自定义函数--打开/关闭登录弹层
   */
  openLogin: function () {
    this.setData({
      showLogin: true
    })
  },
  closeLogin: function () {
    this.setData({
      showLogin: false,
      choosingAvatar: false
    })
  },

  /**
   * 自定义函数--昵称输入
   */
  onNickInput: function (e) {
    this.setData({
      nickInput: e.detail.value
    })
  },

  /**
   * 自定义函数--选择冒险形象（会清空已选择的微信头像）
   */
  chooseAvatar: function (e) {
    this.setData({
      avatarIndex: e.currentTarget.dataset.index,
      loginAvatarPath: ''
    })
  },

  /**
   * 自定义函数--点击微信头像按钮：先锁住按钮，防止选择器打开期间快速连点
   * 重复拉起选择器（触发 “chooseAvatar:fail another chooseAvatar is in progress”）
   */
  onAvatarTap: function () {
    var that = this
    clearTimeout(this.avatarUnlockTimer)
    this.setData({
      choosingAvatar: true
    })
    //兜底：个别情况下取消选择不会回调任何事件，1秒后自动解锁，避免按钮永久失效
    this.avatarUnlockTimer = setTimeout(function () {
      that.setData({
        choosingAvatar: false
      })
    }, 1000)
  },

  /**
   * 自定义函数--选择微信头像（官方chooseAvatar，头像选择器默认就是微信头像）
   * 选择成功或取消都会先解锁按钮，防止状态锁卡死
   */
  onChooseAvatar: function (e) {
    //无论成功还是取消都先解锁
    this.setData({
      choosingAvatar: false
    })
    var url = e.detail && e.detail.avatarUrl
    //取消选择时（部分基础库会回调空路径）保持原预览不变
    if (!url) {
      return
    }
    //chooseAvatar返回的是临时文件路径，先记录下来，登录确认时再复制到用户目录
    this.setData({
      loginAvatarPath: url
    })
  },

  /**
   * 自定义函数--确认登录（微信昵称+微信头像，未选择头像时使用冒险形象）
   */
  confirmLogin: function () {
    //昵称为空时使用默认昵称
    var nick = (this.data.nickInput || '').trim() || '箱子勇士'
    var avatar = this.data.avatars[this.data.avatarIndex].emoji
    var avatarPath = this.data.loginAvatarPath
    if (!avatarPath) {
      //没有选择微信头像时直接使用冒险形象
      this.finishLogin(nick, avatar, '')
      return
    }
    var that = this
    //把微信头像的临时文件复制到用户目录，重启小程序后依然能显示
    var dest = wx.env.USER_DATA_PATH + '/avatar_' + Date.now() + '.png'
    try {
      wx.getFileSystemManager().copyFile({
        srcPath: avatarPath,
        destPath: dest,
        success: function () {
          that.finishLogin(nick, avatar, dest)
        },
        fail: function () {
          //复制失败时退回冒险形象，不影响登录
          that.finishLogin(nick, avatar, '')
        }
      })
    } catch (err) {
      this.finishLogin(nick, avatar, '')
    }
  },

  /**
   * 自定义函数--保存登录结果并刷新页面
   */
  finishLogin: function (nick, avatar, avatarPath) {
    //保存玩家身份到本地缓存（avatarPath为空时头像显示为冒险形象）
    storage.saveUser({
      nickName: nick,
      avatar: avatar,
      avatarPath: avatarPath
    })
    this.setData({
      showLogin: false,
      showPlayer: false,
      nickInput: '',
      loginAvatarPath: '',
      choosingAvatar: false
    })
    this.refresh()
    wx.showToast({
      title: '登录成功',
      icon: 'success'
    })
  },

  /**
   * 自定义函数--退出登录（只清除玩家身份，保留游戏进度）
   */
  logout: function () {
    var that = this
    //二次确认：取消则保持登录状态不变
    wx.showModal({
      title: '退出登录？',
      content: '退出后将恢复为游客身份，游戏通关进度不会被清除。',
      cancelText: '取消',
      confirmText: '退出登录',
      confirmColor: '#F25C4E',
      success: function (res) {
        if (res.confirm) {
          //删除已保存的微信头像文件
          var u = storage.getUser()
          if (u && u.avatarPath) {
            try {
              wx.getFileSystemManager().unlink({
                filePath: u.avatarPath,
                fail: function () {
                }
              })
            } catch (err) {
            }
          }
          //只清除玩家身份，不动游戏进度
          storage.clearUser()
          that.setData({
            showPlayer: false
          })
          that.refresh()
          wx.showToast({
            title: '已退出登录',
            icon: 'none'
          })
        }
      }
    })
  },

  /**
   * 自定义函数--打开/关闭游戏帮助弹层
   */
  openHelp: function () {
    this.setData({
      showHelp: true
    })
  },
  closeHelp: function () {
    this.setData({
      showHelp: false
    })
  },

  /**
   * 自定义函数--打开/关闭我的成绩弹层
   */
  openScores: function () {
    this.setData({
      showScores: true
    })
  },
  closeScores: function () {
    this.setData({
      showScores: false
    })
  },

  /**
   * 自定义函数--打开/关闭游戏设置弹层
   */
  openSettings: function () {
    this.setData({
      showSettings: true
    })
  },
  closeSettings: function () {
    this.setData({
      showSettings: false
    })
  },

  /**
   * 自定义函数--设置项：音效开关
   */
  onSoundChange: function (e) {
    storage.saveSettings({
      soundEnabled: e.detail.value
    })
  },

  /**
   * 自定义函数--设置项：震动反馈开关
   */
  onVibrateChange: function (e) {
    storage.saveSettings({
      vibrateEnabled: e.detail.value
    })
  },

  /**
   * 自定义函数--设置项：游戏提示开关
   */
  onTipsChange: function (e) {
    storage.saveSettings({
      tipsEnabled: e.detail.value
    })
  },

  /**
   * 自定义函数--重置游戏进度（双重确认后清除所有通关与成绩记录）
   */
  resetProgress: function () {
    var that = this
    wx.showModal({
      title: '重置游戏进度',
      content: '确定要清除所有通关与成绩记录吗？',
      cancelText: '取消',
      confirmText: '确定清除',
      confirmColor: '#F25C4E',
      success: function (res) {
        if (res.confirm) {
          storage.clearCompletedLevels()
          storage.clearLevelProgress()
          that.refresh()
          wx.showToast({
            title: '进度已重置',
            icon: 'none'
          })
        }
      }
    })
  },

  /**
   * 自定义函数--重新查看新手教程（下次进入游戏时自动弹出）
   */
  rewatchTutorial: function () {
    storage.setTutorialSeen(false)
    this.setData({
      showSettings: false
    })
    wx.showToast({
      title: '下次进入游戏将显示教程',
      icon: 'none'
    })
  },

  /**
   * 自定义函数--空函数（用于阻止弹层上的触摸滚动穿透）
   */
  noop: function () {
  }
})
