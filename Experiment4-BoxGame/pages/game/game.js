//引用公共JS文件（注意：小程序暂不支持绝对路径引用，只能使用相对路径）
var data = require('../../utils/data.js')
//引用公共存储工具（管理玩家信息、关卡进度、游戏设置与新手教程）
var storage = require('../../utils/storage.js')
//引用推箱子求解器（只在用户主动点击提示时运行）
var solver = require('../../utils/solver.js')

//地图图层数据
var map = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0]
]
//箱子图层数据
var box = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0]
]
//方块的宽度
var w = 40
//滑动触发移动的最小距离（px）：棋盘每格40px，低于30px视为轻点，不移动
var SWIPE_THRESHOLD = 30
//动态演示解法：每两步之间的间隔（毫秒），让玩家看清每一步
var DEMO_STEP_DELAY = 600
//初始化游戏主角（小鸟）的行与列
var row = 0
var col = 0
//游戏是否已经胜利（防止重复触发胜利弹层）
var gameWon = false
//移动历史记录（用于一步撤销，最多保存50步）
var history = []
//当前步数（只有有效移动才计数，撞墙不计）
var steps = 0
//本局是否使用过完整动态演示解法（使用过则本局星级上限2星，防看答案拿三星；
//仅进入页面/切换下一关时复位，“自己挑战/再玩一次”不清除）
var usedSolutionDemo = false
//关卡名称（与首页卡片对应）
var levelNames = ['初次挑战', '小试身手', '动动脑筋', '最终挑战']
//小提示语列表（进入关卡或重来时随机取一句）
var tips = [
  '先观察路线，再开始推动箱子',
  '箱子推进角落后可能就出不来了哦',
  '目标位置的小猪会指引你前进',
  '一步走错不用怕，试试撤销按钮'
]
//各关卡循序渐进的本关提示（根据 data.js 地图结构编写，第1条最粗、第3条最细，不直接给答案）
var levelHints = [
  //第1关：3个目标都在最左边一列（第2列），3个箱子分布在右上、左下、右下
  [
    '三个目标点小猪都排在左数第2列，箱子的大方向都是往左推。',
    '最右边的箱子要沿最底下一行推过来；第5行的箱子往左一推就到目标。',
    '左上方的箱子先往下推，从右侧通道绕到最底下一行再向左，别急着推进角落。'
  ],
  //第2关：4个目标分布在小猪左、上、右、下四个方向
  [
    '四个目标分别在左、上、右、下四个方向，先看清每个箱子离哪个目标最近。',
    '正上方和正下方的箱子都能直线推到目标，左右两侧的箱子要绕通道。',
    '先把左侧箱子往左推两格腾出位置，上方箱子等站到它正下方再直推上去。'
  ],
  //第3关：4个目标集中在左上角区域，4个箱子两两并排
  [
    '四个目标都集中在左上角，所有箱子最终都要往上推。',
    '左上方和右上方的两个箱子直推一次就能到位，别把它们推过头。',
    '底部两个箱子一个借道中间通道推到左侧第4列再上顶，另一个跟在后面，注意顺序。'
  ],
  //第4关：5个目标全在最上面两行，5个箱子分布在中下区域
  [
    '五个目标全在最上面两行，先把箱子往上层通道集中。',
    '中路和右侧的箱子基本直线上去就位，左侧两个箱子要借第4行的横通道。',
    '最上面一行的目标要从正下方直推；推之前先想好自己站在哪里、还能不能退出来。'
  ]
]
//方向名到显示文案的映射
var DIR_TEXT = {
  up: { arrow: '↑', text: '向上' },
  down: { arrow: '↓', text: '向下' },
  left: { arrow: '←', text: '向左' },
  right: { arrow: '→', text: '向右' }
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    //当前关卡（从1开始显示）
    level: 1,
    //当前关卡名称
    levelName: '初次挑战',
    //是否显示胜利弹层
    won: false,
    //本局获得星级 / 星星逐颗弹出进度 / 历史最佳步数（胜利弹层展示）
    winStars: 0,
    winStarsShown: 0,
    bestSteps: 0,
    //当前步数
    steps: 0,
    //是否可以撤销
    canUndo: false,
    //随机小提示
    tip: '',
    //是否显示新手教程弹层
    showTutorial: false,
    //是否显示游戏菜单弹层
    showMenu: false,
    //震动反馈开关（读取自游戏设置）
    vibrateEnabled: true,
    //游戏提示开关（读取自游戏设置）
    tipsEnabled: true,
    //提示中心弹层开关（💡 提示按钮，与 tipsEnabled 无关，主动求助始终可用）
    showHelpModal: false,
    showHowTo: false,
    showLevelHint: false,
    showNextStep: false,
    showDeadlock: false,
    //本关提示进度（0~2，切换关卡后重新从第1条开始）
    hintIndex: 0,
    hintLevel: 0,
    hintText: '',
    //下一步提示结果（箭头 + 文案；文案为 complex/won 时走特殊分支）
    hintArrow: '',
    hintStepText: '',
    //求解计算中标记（下一步提示使用，防止重复点击，弹层显示“正在思考”）
    isSolving: false,
    //动态演示解法状态：正在播放 / 暂停 / 规划路线中
    isDemoPlaying: false,
    isDemoPaused: false,
    isPlanningDemo: false,
    //已执行的演示步数 + 完整解法序列
    demoStepIndex: 0,
    demoSolution: [],
    //当前演示步骤的方向（控制条文案 + 方向键高亮）
    demoDirection: '',
    demoDirText: '',
    demoDirArrow: '',
    //演示相关弹层
    showDemoDone: false,
    showDemoStuck: false,
    showDemoFail: false,
    showStopChoice: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    //关卡统一约定：URL参数与页面展示均为1~4（第几关），地图数组下标为0~3，只在这里转换一次
    let level = Number(options.level) || 1
    let mapIndex = level - 1
    //更新页面关卡标题
    this.setData({
      level: level
    })
    //重置游戏状态（防止重复进入页面时状态残留）
    gameWon = false
    history = []
    steps = 0
    //重置本局“是否用过完整演示”标记（用过演示本局星级上限2星）
    usedSolutionDemo = false
    //初始化滑动起点（滑动结束时会清除，空值表示当前没有滑动）
    this.touchStartX = null
    this.touchStartY = null
    //清掉可能残留的演示计时器（重新进入页面时）
    clearTimeout(this.demoTimer)
    //读取游戏设置与新手教程状态（第一次进入游戏自动弹出教程）
    var settings = storage.getSettings()
    this.setData({
      levelName: levelNames[mapIndex],
      steps: 0,
      canUndo: false,
      winStars: 0,
      winStarsShown: 0,
      bestSteps: 0,
      tip: this.randomTip(),
      vibrateEnabled: settings.vibrateEnabled,
      tipsEnabled: settings.tipsEnabled,
      showTutorial: !storage.getTutorialSeen(),
      //重置提示系统状态
      showHelpModal: false,
      showHowTo: false,
      showLevelHint: false,
      showNextStep: false,
      showDeadlock: false,
      hintIndex: 0,
      hintLevel: 0,
      hintText: '',
      hintArrow: '',
      hintStepText: '',
      isSolving: false,
      //重置动态演示状态
      isDemoPlaying: false,
      isDemoPaused: false,
      isPlanningDemo: false,
      demoStepIndex: 0,
      demoSolution: [],
      demoDirection: '',
      demoDirText: '',
      demoDirArrow: '',
      showDemoDone: false,
      showDemoStuck: false,
      showDemoFail: false,
      showStopChoice: false
    })
    //创建画布上下文
    this.ctx = wx.createCanvasContext('myCanvas')
    //初始化地图数据（传入地图数组下标）
    this.initMap(mapIndex)
    //绘制画布内容
    this.drawCanvas()
    //后台预热星级阈值（通关结算时需要，提前算好避免结算卡顿）
    var that = this
    setTimeout(function () {
      data.getLevelMeta()
    }, 600)
  },

  /**
   * 生命周期函数--监听页面卸载（清除演示计时器与胜利星星动画计时器）
   */
  onUnload: function () {
    clearTimeout(this.demoTimer)
    clearTimeout(this.winStarTimer2)
    clearTimeout(this.winStarTimer3)
    clearTimeout(this.winStarTimer4)
  },

  /**
   * 自定义函数--初始化地图数据
   */
  initMap: function (mapIndex) {
    //读取原始的游戏地图数据（mapIndex为地图数组下标0~3 = 显示关卡-1）
    let mapData = data.maps[mapIndex]
    //使用双重for循环记录地图数据
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        box[i][j] = 0
        map[i][j] = mapData[i][j]

        //如果原始数据中是箱子，将其记录到箱子图层，地图图层改为路
        if (mapData[i][j] == 4) {
          box[i][j] = 4
          map[i][j] = 2
        } else if (mapData[i][j] == 5) {
          //如果原始数据中是人物，地图图层改为路，并记录小鸟的当前行和列
          map[i][j] = 2
          row = i
          col = j
        }
      }
    }
  },

  /**
   * 自定义函数--绘制地图
   */
  drawCanvas: function () {
    let ctx = this.ctx
    //清空画布
    ctx.clearRect(0, 0, 320, 320)
    //使用双重for循环绘制8x8的地图
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        //默认是道路
        let img = 'ice'
        if (map[i][j] == 1) {
          //如果是墙，绘制石头
          img = 'stone'
        } else if (map[i][j] == 3) {
          //如果是终点，绘制小猪
          img = 'pig'
        }
        //绘制地图
        ctx.drawImage('/images/icons/' + img + '.png', j * w, i * w, w, w)
        if (box[i][j] == 4) {
          //叠加绘制箱子
          ctx.drawImage('/images/icons/box.png', j * w, i * w, w, w)
        }
      }
    }
    //叠加绘制小鸟
    ctx.drawImage('/images/icons/bird.png', col * w, row * w, w, w)
    ctx.draw()
  },

  /**
   * 自定义函数--重建画布上下文并绘制
   * （胜利弹层显示期间画布节点被移除，恢复时需要重建上下文）
   */
  initCanvas: function () {
    //重建画布上下文（旧上下文已随被移除的节点失效）
    this.ctx = wx.createCanvasContext('myCanvas')
    //绘制画布内容
    this.drawCanvas()
  },

  /**
   * 自定义函数--手动输入是否被演示锁定
   * 演示进行中（含暂停）锁定滑动/方向键/撤销/重来/提示；
   * 演示自己的每一步通过 demoExecMove 标记放行
   */
  isInputLocked: function () {
    return (this.data.isDemoPlaying || this.data.isDemoPaused) && !this.demoExecMove
  },

  /**
   * 自定义函数--方向键：上
   */
  up: function () {
    //演示进行中（含暂停）锁定手动输入；演示自己的移动通过 demoExecMove 放行
    if (this.isInputLocked()) {
      return
    }
    //不在最顶端才考虑上移
    if (row > 0) {
      //记录移动前的位置与状态（用于一步撤销，撞墙不会保存）
      var oldRow = row
      var oldCol = col
      var snapshot = this.makeSnapshot()
      //如果上方不是墙或箱子，可以移动小鸟
      if (map[row - 1][col] != 1 && box[row - 1][col] != 4) {
        //更新当前小鸟的坐标
        row = row - 1
      }
      //如果上方是箱子
      else if (box[row - 1][col] == 4) {
        //箱子不在最顶端才能考虑推动
        if (row - 1 > 0) {
          //如果箱子上方不是墙或箱子
          if (map[row - 2][col] != 1 && box[row - 2][col] != 4) {
            //箱子向上移动一格，原来位置清空
            box[row - 2][col] = 4
            box[row - 1][col] = 0
            //更新当前小鸟的坐标
            row = row - 1
          }
        }
      }
      //只有位置真正发生变化才算一次有效移动（计入步数与撤销历史）
      if (row != oldRow || col != oldCol) {
        this.commitMove(snapshot)
      }
      //重新绘制地图
      this.drawCanvas()
      //检查游戏是否成功
      this.checkWin()
    }
  },

  /**
   * 自定义函数--方向键：下
   */
  down: function () {
    //演示进行中（含暂停）锁定手动输入；演示自己的移动通过 demoExecMove 放行
    if (this.isInputLocked()) {
      return
    }
    //不在最底端才考虑下移
    if (row < 7) {
      //记录移动前的位置与状态（用于一步撤销，撞墙不会保存）
      var oldRow = row
      var oldCol = col
      var snapshot = this.makeSnapshot()
      //如果下方不是墙或箱子，可以移动小鸟
      if (map[row + 1][col] != 1 && box[row + 1][col] != 4) {
        //更新当前小鸟的坐标
        row = row + 1
      }
      //如果下方是箱子
      else if (box[row + 1][col] == 4) {
        //箱子不在最底端才能考虑推动
        if (row + 1 < 7) {
          //如果箱子下方不是墙或箱子
          if (map[row + 2][col] != 1 && box[row + 2][col] != 4) {
            //箱子向下移动一格，原来位置清空
            box[row + 2][col] = 4
            box[row + 1][col] = 0
            //更新当前小鸟的坐标
            row = row + 1
          }
        }
      }
      //只有位置真正发生变化才算一次有效移动（计入步数与撤销历史）
      if (row != oldRow || col != oldCol) {
        this.commitMove(snapshot)
      }
      //重新绘制地图
      this.drawCanvas()
      //检查游戏是否成功
      this.checkWin()
    }
  },

  /**
   * 自定义函数--方向键：左
   */
  left: function () {
    //演示进行中（含暂停）锁定手动输入；演示自己的移动通过 demoExecMove 放行
    if (this.isInputLocked()) {
      return
    }
    //不在最左侧才考虑左移
    if (col > 0) {
      //记录移动前的位置与状态（用于一步撤销，撞墙不会保存）
      var oldRow = row
      var oldCol = col
      var snapshot = this.makeSnapshot()
      //如果左侧不是墙或箱子，可以移动小鸟
      if (map[row][col - 1] != 1 && box[row][col - 1] != 4) {
        //更新当前小鸟的坐标
        col = col - 1
      }
      //如果左侧是箱子
      else if (box[row][col - 1] == 4) {
        //箱子不在最左侧才能考虑推动
        if (col - 1 > 0) {
          //如果箱子左侧不是墙或箱子
          if (map[row][col - 2] != 1 && box[row][col - 2] != 4) {
            //箱子向左移动一格，原来位置清空
            box[row][col - 2] = 4
            box[row][col - 1] = 0
            //更新当前小鸟的坐标
            col = col - 1
          }
        }
      }
      //只有位置真正发生变化才算一次有效移动（计入步数与撤销历史）
      if (row != oldRow || col != oldCol) {
        this.commitMove(snapshot)
      }
      //重新绘制地图
      this.drawCanvas()
      //检查游戏是否成功
      this.checkWin()
    }
  },

  /**
   * 自定义函数--方向键：右
   */
  right: function () {
    //演示进行中（含暂停）锁定手动输入；演示自己的移动通过 demoExecMove 放行
    if (this.isInputLocked()) {
      return
    }
    //不在最右侧才考虑右移
    if (col < 7) {
      //记录移动前的位置与状态（用于一步撤销，撞墙不会保存）
      var oldRow = row
      var oldCol = col
      var snapshot = this.makeSnapshot()
      //如果右侧不是墙或箱子，可以移动小鸟
      if (map[row][col + 1] != 1 && box[row][col + 1] != 4) {
        //更新当前小鸟的坐标
        col = col + 1
      }
      //如果右侧是箱子
      else if (box[row][col + 1] == 4) {
        //箱子不在最右侧才能考虑推动
        if (col + 1 < 7) {
          //如果箱子右侧不是墙或箱子
          if (map[row][col + 2] != 1 && box[row][col + 2] != 4) {
            //箱子向右移动一格，原来位置清空
            box[row][col + 2] = 4
            box[row][col + 1] = 0
            //更新当前小鸟的坐标
            col = col + 1
          }
        }
      }
      //只有位置真正发生变化才算一次有效移动（计入步数与撤销历史）
      if (row != oldRow || col != oldCol) {
        this.commitMove(snapshot)
      }
      //重新绘制地图
      this.drawCanvas()
      //检查游戏是否成功
      this.checkWin()
    }
  },

  /**
   * 自定义函数--滑动开始：记录手指起点（棋盘区域）
   */
  onTouchStart: function (e) {
    //演示进行中不响应滑动
    if (this.data.isDemoPlaying || this.data.isDemoPaused) {
      return
    }
    var t = e.touches[0]
    this.touchStartX = t.clientX
    this.touchStartY = t.clientY
  },

  /**
   * 自定义函数--滑动被系统中断（如来电）：清除起点，避免误触发移动
   */
  onTouchCancel: function () {
    this.touchStartX = null
    this.touchStartY = null
  },

  /**
   * 自定义函数--滑动结束：按主方向调用现有 up/down/left/right
   * 一次滑动只处理一次；胜利后忽略滑动；轻点（距离不足阈值）不移动
   */
  onTouchEnd: function (e) {
    //演示进行中或胜利弹层出现后（won/gameWon）不再响应滑动
    if (this.data.isDemoPlaying || this.data.isDemoPaused || this.data.won || gameWon) {
      return
    }
    //没有记录起点（滑动被取消或未在棋盘按下）时不处理
    if (this.touchStartX === null || this.touchStartX === undefined) {
      return
    }
    var t = e.changedTouches[0]
    var deltaX = t.clientX - this.touchStartX
    var deltaY = t.clientY - this.touchStartY
    //先清除起点，保证一次滑动只判断一次方向
    this.touchStartX = null
    this.touchStartY = null
    //滑动距离不够阈值时视为轻点，不移动
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) {
      return
    }
    //以偏移更大的轴作为主方向，斜滑也按主方向移动一格
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      //水平滑动：向右为正
      if (deltaX > 0) {
        this.right()
      } else {
        this.left()
      }
    } else {
      //垂直滑动：向下为正
      if (deltaY > 0) {
        this.down()
      } else {
        this.up()
      }
    }
  },

  /**
   * 自定义函数--判断游戏是否成功
   */
  isWin: function () {
    //使用双重for循环遍历整个数组
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        //如果有箱子没在终点
        if (box[i][j] == 4 && map[i][j] != 3) {
          //返回false，表示游戏尚未成功
          return false
        }
      }
    }
    //返回true，表示游戏成功
    return true
  },

  /**
   * 自定义函数--按步数计算本局星级：
   * steps <= optimalSteps 拿3星；steps <= twoStarSteps 拿2星；否则1星
   */
  calculateStars: function (level, steps) {
    var meta = data.getLevelMeta()[level - 1]
    if (meta && steps <= meta.optimalSteps) {
      return 3
    }
    if (meta && steps <= meta.twoStarSteps) {
      return 2
    }
    return 1
  },

  /**
   * 自定义函数--游戏成功处理
   */
  checkWin: function () {
    //判断游戏是否成功，成功且尚未弹层时显示胜利弹层
    if (this.isWin() && !gameWon) {
      //标记游戏已经胜利，防止重复移动时连续触发胜利弹层
      gameWon = true
      //演示模式：不弹普通通关弹窗、不记录成绩，由演示流程自己收尾
      if (this.data.isDemoPlaying) {
        return
      }
      //通关震动反馈（设置中可关闭，异常不会影响游戏）
      this.vibrate('medium')
      //按步数评星；本局使用过完整动态演示时星级上限2星
      var stars = this.calculateStars(this.data.level, steps)
      if (usedSolutionDemo) {
        stars = Math.min(stars, 2)
      }
      //保存成绩（更差的成绩不会覆盖历史最好成绩），取回最终保存的bestSteps展示
      var result = storage.recordLevelResult(this.data.level, steps, stars)
      //显示胜利弹层（星星逐颗弹出）
      this.setData({
        won: true,
        winStars: stars,
        winStarsShown: 0,
        bestSteps: result.bestSteps
      })
      var that = this
      this.winStarTimer2 = setTimeout(function () {
        that.setData({ winStarsShown: 1 })
      }, 250)
      this.winStarTimer3 = setTimeout(function () {
        that.setData({ winStarsShown: 2 })
      }, 500)
      this.winStarTimer4 = setTimeout(function () {
        that.setData({ winStarsShown: 3 })
      }, 750)
    }
  },

  /**
   * 自定义函数--重新开始游戏（先弹确认框，避免误触）
   */
  restartGame: function () {
    //演示进行中不允许手动重来
    if (this.isInputLocked()) {
      return
    }
    var that = this
    wx.showModal({
      title: '重新开始本关？',
      content: '当前进度会被清除',
      cancelText: '取消',
      confirmText: '重新开始',
      confirmColor: '#FF8E3C',
      success: function (res) {
        //用户点击“重新开始”确认后重置当前关卡
        if (res.confirm) {
          that.resetLevel()
        }
      }
    })
  },

  /**
   * 自定义函数--重置当前关卡（人物与箱子恢复初始位置）
   */
  resetLevel: function () {
    //恢复未胜利状态并关闭胜利弹层
    gameWon = false
    //清空撤销历史并重置步数
    history = []
    steps = 0
    //初始化地图数据（data中的level从1开始显示，地图下标从0开始）
    this.initMap(this.data.level - 1)
    var that = this
    this.setData({
      won: false,
      steps: 0,
      canUndo: false,
      winStars: 0,
      winStarsShown: 0,
      bestSteps: 0,
      tip: this.randomTip(),
      //复位动态演示状态，防止暂停/方向高亮等残留影响后续操作
      isDemoPaused: false,
      demoStepIndex: 0,
      demoSolution: [],
      demoDirection: '',
      demoDirText: '',
      demoDirArrow: ''
    }, function () {
      //画布节点随setData重新渲染后才存在，重建上下文并重绘
      that.initCanvas()
    })
  },

  /**
   * 自定义函数--胜利弹层：再玩一次
   */
  replayGame: function () {
    //重置当前关卡并关闭胜利弹层
    this.resetLevel()
  },

  /**
   * 自定义函数--胜利弹层：下一关
   */
  nextLevel: function () {
    //第4关没有下一关
    if (this.data.level >= 4) {
      return
    }
    //恢复未胜利状态并关闭胜利弹层
    gameWon = false
    //清空撤销历史并重置步数
    history = []
    steps = 0
    //切换到下一关：本局“用过完整演示”的星级限制随关卡重置
    usedSolutionDemo = false
    //更新页面关卡标题（level + 1）
    var next = this.data.level + 1
    //初始化下一关地图数据（地图下标 = 显示关卡 - 1）
    this.initMap(next - 1)
    var that = this
    this.setData({
      level: next,
      levelName: levelNames[next - 1],
      won: false,
      steps: 0,
      canUndo: false,
      winStars: 0,
      winStarsShown: 0,
      bestSteps: 0,
      tip: this.randomTip()
    }, function () {
      //画布节点随setData重新渲染后才存在，重建上下文并重绘
      that.initCanvas()
    })
  },

  /**
   * 自定义函数--胜利弹层：返回选关
   */
  backToMenu: function () {
    //返回上一页（选关页面）
    wx.navigateBack({
      fail: function () {
        //如果页面栈中没有上一页（如直接以编译模式打开游戏页），直接跳回首页
        wx.reLaunch({
          url: '/pages/index/index'
        })
      }
    })
  },

  /**
   * 自定义函数--空函数（用于阻止胜利弹层上的触摸滚动穿透）
   */
  noop: function () {
  },

  /**
   * 自定义函数--生成当前地图与人物位置的快照（用于一步撤销）
   */
  makeSnapshot: function () {
    //深拷贝地图与箱子图层，避免历史记录被后续移动修改
    return {
      map: map.map(function (r) {
        return r.slice()
      }),
      box: box.map(function (r) {
        return r.slice()
      }),
      row: row,
      col: col,
      steps: steps
    }
  },

  /**
   * 自定义函数--处理一次有效移动：保存撤销历史、更新步数、推箱震动
   */
  commitMove: function (snapshot) {
    //对比移动前后的箱子图层，判断本次是否推动了箱子
    var pushed = false
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        if (snapshot.box[i][j] != box[i][j]) {
          pushed = true
        }
      }
    }
    //推箱成功时给出震动反馈（设置中可关闭）
    if (pushed) {
      this.vibrate('light')
    }
    //演示模式：不把自动移动计入玩家步数，也不写入撤销历史
    if (this.data.isDemoPlaying) {
      return
    }
    //保存移动前的状态用于撤销（最多保留50步）
    history.push(snapshot)
    if (history.length > 50) {
      history.shift()
    }
    //步数加1
    steps++
    this.setData({
      steps: steps,
      canUndo: true
    })
  },

  /**
   * 自定义函数--震动反馈（仅在开启且API可用时触发，任何异常都不影响游戏）
   */
  vibrate: function (type) {
    if (!this.data.vibrateEnabled) {
      return
    }
    try {
      if (wx.vibrateShort) {
        wx.vibrateShort({
          type: type || 'light',
          fail: function () {
          }
        })
      }
    } catch (e) {
    }
  },

  /**
   * 自定义函数--一步撤销：恢复上一步的地图、箱子、人物位置与步数
   */
  undo: function () {
    //演示进行中不允许手动撤销
    if (this.isInputLocked()) {
      return
    }
    //没有历史记录时不可撤销
    if (history.length == 0) {
      return
    }
    //取出上一步的状态
    var s = history.pop()
    //恢复地图与箱子图层
    for (var i = 0; i < 8; i++) {
      for (var j = 0; j < 8; j++) {
        map[i][j] = s.map[i][j]
        box[i][j] = s.box[i][j]
      }
    }
    //恢复人物位置与步数
    row = s.row
    col = s.col
    steps = s.steps
    this.setData({
      steps: steps,
      canUndo: history.length > 0
    })
    //重新绘制地图
    this.drawCanvas()
  },

  /**
   * 自定义函数--随机取一句小提示
   */
  randomTip: function () {
    return tips[Math.floor(Math.random() * tips.length)]
  },

  /**
   * 自定义函数--关闭新手教程弹层（标记已看过，下次进入不再自动弹出）
   */
  closeTutorial: function () {
    storage.setTutorialSeen(true)
    this.setData({
      showTutorial: false
    })
  },

  /**
   * 自定义函数--打开/关闭游戏菜单弹层（顶部右侧⚙）
   */
  openMenu: function () {
    this.setData({
      showMenu: true
    })
  },
  closeMenu: function () {
    this.setData({
      showMenu: false
    })
  },

  /**
   * 自定义函数--游戏菜单：查看游戏帮助（打开教程弹层）
   */
  showHelp: function () {
    storage.setTutorialSeen(true)
    this.setData({
      showMenu: false,
      showTutorial: true
    })
  },

  /**
   * 自定义函数--打开/关闭提示中心（💡 提示按钮）
   */
  openHelp: function () {
    //演示进行中不允许再次打开提示中心
    if (this.isInputLocked()) {
      return
    }
    this.setData({
      showHelpModal: true
    })
  },
  closeHelp: function () {
    this.setData({
      showHelpModal: false
    })
  },

  /**
   * 自定义函数--提示中心：怎么玩
   */
  openHowTo: function () {
    this.setData({
      showHelpModal: false,
      showHowTo: true
    })
  },
  closeHowTo: function () {
    this.setData({
      showHowTo: false
    })
  },

  /**
   * 自定义函数--提示中心：本关提示
   * 每次打开显示当前进度，关闭后再次打开可以继续；切换关卡后重新从第1条开始
   */
  openLevelHint: function () {
    var level = this.data.level
    var idx = this.data.hintIndex
    if (this.data.hintLevel !== level) {
      idx = 0
    }
    this.setData({
      showHelpModal: false,
      showLevelHint: true,
      hintLevel: level,
      hintIndex: idx,
      hintText: levelHints[level - 1][idx]
    })
  },
  nextLevelHint: function () {
    var idx = (this.data.hintIndex + 1) % levelHints[this.data.level - 1].length
    this.setData({
      hintIndex: idx,
      hintText: levelHints[this.data.level - 1][idx]
    })
  },
  closeLevelHint: function () {
    this.setData({
      showLevelHint: false
    })
  },

  /**
   * 自定义函数--提示中心：下一步提示
   * 用BFS求解当前局面，只给出方向建议，不自动移动、不计步数
   */
  nextStepHint: function () {
    var that = this
    //正在计算时或演示进行中防止重复点击
    if (this.data.isSolving || this.data.isDemoPlaying || this.data.isDemoPaused) {
      return
    }
    //先做基础死局判断：箱子卡死在非目标点死角时直接提醒
    if (solver.hasDeadlock(map, box)) {
      this.setData({
        showHelpModal: false,
        showDeadlock: true
      })
      return
    }
    this.setData({
      showHelpModal: false,
      showNextStep: true,
      isSolving: true
    })
    //先让“正在思考”渲染出来再求解，避免界面没有反馈
    setTimeout(function () {
      var snap = that.makeSnapshot()
      var res = solver.solve(snap.map, snap.box, { row: snap.row, col: snap.col })
      if (res.found && res.moves.length > 0) {
        var meta = DIR_TEXT[res.moves[0]]
        that.setData({
          isSolving: false,
          hintArrow: meta.arrow,
          hintStepText: meta.text
        })
      } else if (res.found) {
        //所有箱子已经到位（正常情况胜利弹层已经出现）
        that.setData({
          isSolving: false,
          hintArrow: '',
          hintStepText: 'won'
        })
      } else {
        that.setData({
          isSolving: false,
          hintArrow: '',
          hintStepText: 'complex'
        })
      }
    }, 60)
  },
  closeNextStep: function () {
    this.setData({
      showNextStep: false
    })
  },

  /**
   * 自定义函数--提示中心：动态演示解法入口
   * 先检查当前局面是否死局，再求解并开始自动演示
   */
  planDemo: function () {
    //演示进行中或正在规划时不重复启动
    if (this.data.isDemoPlaying || this.data.isPlanningDemo) {
      return
    }
    //当前局面已进入死局：先建议撤销或重新开始
    if (solver.hasDeadlock(map, box)) {
      this.setData({
        showDemoStuck: true
      })
      return
    }
    this.planAndPlayDemo(false)
  },

  /**
   * 自定义函数--规划并播放演示
   * restartFirst：先恢复本关初始状态再从头演示
   */
  planAndPlayDemo: function (restartFirst) {
    var that = this
    if (this.data.isDemoPlaying || this.data.isPlanningDemo) {
      return
    }
    if (restartFirst) {
      this.resetLevel()
    }
    //帮助弹窗保持打开，按钮显示“正在规划路线 🤔”
    this.setData({
      isPlanningDemo: true,
      showHelpModal: true,
      showDemoStuck: false,
      showDemoDone: false,
      showDemoFail: false,
      showStopChoice: false
    })
    setTimeout(function () {
      var snap = that.makeSnapshot()
      var r = solver.solve(snap.map, snap.box, { row: snap.row, col: snap.col })
      that.setData({
        isPlanningDemo: false
      })
      if (r.found && r.moves.length > 0) {
        //关闭帮助弹窗，回到真实棋盘开始自动演示
        that.setData({
          showHelpModal: false
        })
        that.startDemo(r.moves)
      } else {
        //当前局面在限制内找不到可行解法
        that.setData({
          showDemoFail: true
        })
      }
    }, 60)
  },

  /**
   * 自定义函数--开始自动演示：一步步调用真实方向函数执行解法
   */
  startDemo: function (moves) {
    //本局使用过完整动态演示：结算时星级上限2星（防看答案拿三星）
    usedSolutionDemo = true
    //清掉可能残留的旧计时器
    clearTimeout(this.demoTimer)
    this.setData({
      isDemoPlaying: true,
      isDemoPaused: false,
      demoStepIndex: 0,
      demoSolution: moves,
      demoDirection: '',
      demoDirText: '',
      demoDirArrow: ''
    })
    //立即执行第一步
    this.demoStep()
  },

  /**
   * 自定义函数--演示的每一步：执行一步后调度下一步（每步之间间隔 DEMO_STEP_DELAY）
   */
  demoStep: function () {
    var that = this
    //已停止或已暂停时不再走下一步
    if (!this.data.isDemoPlaying || this.data.isDemoPaused) {
      return
    }
    var moves = this.data.demoSolution
    var i = this.data.demoStepIndex
    if (i >= moves.length) {
      this.finishDemo()
      return
    }
    var dir = moves[i]
    var meta = DIR_TEXT[dir]
    this.setData({
      demoDirection: dir,
      demoDirText: meta.text,
      demoDirArrow: meta.arrow
    })
    //用内部标记放行演示自身的移动（手动输入仍被锁定）
    this.demoExecMove = true
    this[dir]()
    this.demoExecMove = false
    var next = i + 1
    this.setData({
      demoStepIndex: next
    })
    if (next >= moves.length) {
      //最后一步完成：稍等片刻让玩家看清棋盘，再显示演示完成弹层
      this.finishDemo()
      return
    }
    this.demoTimer = setTimeout(function () {
      that.demoStep()
    }, DEMO_STEP_DELAY)
  },

  /**
   * 自定义函数--演示收尾：保持输入锁定一小段时间，随后显示“演示完成”弹层
   */
  finishDemo: function () {
    var that = this
    this.setData({
      isDemoPaused: false,
      demoDirection: ''
    })
    //让玩家看清最后一步再弹出完成提示（暂停状态一并复位，防止输入锁残留）
    this.demoTimer = setTimeout(function () {
      that.setData({
        isDemoPlaying: false,
        isDemoPaused: false,
        showDemoDone: true
      })
    }, DEMO_STEP_DELAY)
  },

  /**
   * 自定义函数--暂停/继续演示（暂停后每一步调度都会在检查点停下）
   */
  pauseDemo: function () {
    this.setData({
      isDemoPaused: true
    })
  },
  resumeDemo: function () {
    this.setData({
      isDemoPaused: false
    })
    //从当前步骤继续
    this.demoStep()
  },

  /**
   * 自定义函数--停止演示：取消后续所有自动移动，让玩家选择去向
   */
  stopDemo: function () {
    clearTimeout(this.demoTimer)
    //演示的最后一步已经完成通关：直接走“演示完成”收尾
    if (gameWon) {
      this.setData({
        isDemoPlaying: false,
        isDemoPaused: false,
        showDemoDone: true
      })
      return
    }
    this.setData({
      isDemoPlaying: false,
      isDemoPaused: false,
      demoDirection: '',
      showStopChoice: true
    })
  },
  stopChoiceKeep: function () {
    //保留演示已经走到的棋盘状态，玩家继续自己玩
    this.setData({
      showStopChoice: false
    })
  },
  stopChoiceRestart: function () {
    //恢复本关初始状态
    this.setData({
      showStopChoice: false
    })
    this.resetLevel()
  },

  /**
   * 自定义函数--演示完成弹层：自己挑战 / 再看一次 / 返回选关
   */
  demoDoneChallenge: function () {
    this.setData({
      showDemoDone: false
    })
    //重新初始化当前关卡：steps=0、history 清空、gameWon=false
    this.resetLevel()
  },
  demoDoneReplay: function () {
    //从头重新开始并再次演示
    this.planAndPlayDemo(true)
  },

  /**
   * 自定义函数--演示死局弹层：撤销一步 / 重新开始并演示 / 关闭
   */
  demoStuckUndo: function () {
    this.setData({
      showDemoStuck: false
    })
    this.undo()
  },
  demoRestartAndPlay: function () {
    this.planAndPlayDemo(true)
  },
  closeDemoStuck: function () {
    this.setData({
      showDemoStuck: false
    })
  },
  closeDemoFail: function () {
    this.setData({
      showDemoFail: false
    })
  },

  /**
   * 自定义函数--死局弹层：撤销一步 / 重新开始 / 关闭
   */
  deadlockUndo: function () {
    this.setData({
      showDeadlock: false
    })
    this.undo()
  },
  deadlockRestart: function () {
    this.setData({
      showDeadlock: false
    })
    this.restartGame()
  },
  closeDeadlock: function () {
    this.setData({
      showDeadlock: false
    })
  }
})
