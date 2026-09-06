//================
//轻量推箱子求解器（BFS）
//只在用户主动点击“下一步提示 / 查看解法”时运行，不在移动或页面加载时执行
//================

//棋盘大小
var SIZE = 8
//四个方向（与 game.js 中的方向函数同名，方便直接调用）
var DIRS = [
  { name: 'up', dr: -1, dc: 0 },
  { name: 'down', dr: 1, dc: 0 },
  { name: 'left', dr: 0, dc: -1 },
  { name: 'right', dr: 0, dc: 1 }
]

/**
 * 判断是否墙：1为墙，0为地图外围，越界同样视为墙
 */
function isWall(map, r, c) {
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) {
    return true
  }
  return map[r][c] === 1 || map[r][c] === 0
}

/**
 * 收集箱子位置列表
 */
function collectBoxes(box) {
  var boxes = []
  for (var i = 0; i < SIZE; i++) {
    for (var j = 0; j < SIZE; j++) {
      if (box[i][j] === 4) {
        boxes.push({ r: i, c: j })
      }
    }
  }
  return boxes
}

/**
 * 生成状态key：人物位置 + 排序后的箱子位置，避免重复搜索
 */
function stateKey(pr, pc, boxes) {
  var sorted = boxes.slice().sort(function (a, b) {
    if (a.r !== b.r) {
      return a.r - b.r
    }
    return a.c - b.c
  })
  var s = pr + ',' + pc + '|'
  for (var i = 0; i < sorted.length; i++) {
    s += sorted[i].r + ',' + sorted[i].c + ';'
  }
  return s
}

/**
 * 是否所有箱子都在目标点
 */
function isGoal(map, boxes) {
  for (var i = 0; i < boxes.length; i++) {
    if (map[boxes[i].r][boxes[i].c] !== 3) {
      return false
    }
  }
  return true
}

/**
 * 基础死锁判断：箱子在非目标点，且横竖两个方向都无法再推动
 * （推箱子时人必须站在箱子对面，所以箱子移动要求左右/上下两侧都可进入；
 *   任一侧是墙，该方向就无法推动）
 * 目标点本身在死角不误判
 */
function hasDeadlock(map, box) {
  for (var i = 0; i < SIZE; i++) {
    for (var j = 0; j < SIZE; j++) {
      if (box[i][j] !== 4) {
        continue
      }
      //箱子已在目标点，不算死局
      if (map[i][j] === 3) {
        continue
      }
      var up = isWall(map, i - 1, j)
      var down = isWall(map, i + 1, j)
      var left = isWall(map, i, j - 1)
      var right = isWall(map, i, j + 1)
      //水平可推：左右两侧都能进入（一侧站人、一侧放箱子）
      var canH = !left && !right
      //垂直可推：上下两侧都能进入
      var canV = !up && !down
      if (!canH && !canV) {
        return true
      }
    }
  }
  return false
}

/**
 * BFS求解：从当前局面搜索到通关的最短操作序列
 * map/box 只读不修改；maxStates 限制最大搜索状态数，防止卡死
 * 返回 { found, moves, states, limited }
 */
function solve(map, box, player, maxStates) {
  //实测：四关初始局面最多需要约7.6万状态（第4关），10万上限留有余量且不卡顿
  maxStates = maxStates || 100000
  //预计算“永久死角”：非目标格上横竖两个方向都推不动的格子
  //（只把墙当障碍——墙永远不会移动，所以落在这些格子上的箱子永远出不来，
  //  搜索时直接剪掉该分支，大幅减少状态数）
  var deadCell = []
  for (var i = 0; i < SIZE; i++) {
    deadCell.push([])
    for (var j = 0; j < SIZE; j++) {
      var isDead = false
      if (map[i][j] !== 3) {
        var lw = isWall(map, i, j - 1)
        var rw = isWall(map, i, j + 1)
        var uw = isWall(map, i - 1, j)
        var dw = isWall(map, i + 1, j)
        isDead = (lw || rw) && (uw || dw)
      }
      deadCell[i].push(isDead)
    }
  }
  var boxes = collectBoxes(box)
  //当前已经通关
  if (isGoal(map, boxes)) {
    return { found: true, moves: [], states: 1, limited: false }
  }
  //初始局面就有箱子卡死在死角，直接判定不可解
  for (var d0 = 0; d0 < boxes.length; d0++) {
    if (deadCell[boxes[d0].r][boxes[d0].c]) {
      return { found: false, moves: [], states: 1, limited: false }
    }
  }
  var startKey = stateKey(player.row, player.col, boxes)
  //visited：状态是否搜索过；prev：状态 -> {from, move}，用于还原路径
  var visited = {}
  var prev = {}
  visited[startKey] = true
  var queue = [{ pr: player.row, pc: player.col, boxes: boxes, key: startKey }]
  var states = 1
  //用下标代替 shift()，避免大数组出队性能问题
  var head = 0
  while (head < queue.length) {
    var cur = queue[head++]
    for (var d = 0; d < DIRS.length; d++) {
      var dir = DIRS[d]
      var nr = cur.pr + dir.dr
      var nc = cur.pc + dir.dc
      //人不能穿墙
      if (isWall(map, nr, nc)) {
        continue
      }
      //检查要进入的位置是否有箱子
      var bi = -1
      for (var b = 0; b < cur.boxes.length; b++) {
        if (cur.boxes[b].r === nr && cur.boxes[b].c === nc) {
          bi = b
          break
        }
      }
      var newBoxes = cur.boxes
      if (bi >= 0) {
        //推箱子：箱子后方必须是可进入位置（不能是墙或另一个箱子）
        var br = nr + dir.dr
        var bc = nc + dir.dc
        if (isWall(map, br, bc)) {
          continue
        }
        var blocked = false
        for (var b2 = 0; b2 < cur.boxes.length; b2++) {
          if (b2 !== bi && cur.boxes[b2].r === br && cur.boxes[b2].c === bc) {
            blocked = true
            break
          }
        }
        if (blocked) {
          continue
        }
        //箱子被推进永久死角：该分支永远无法通关，剪掉
        if (deadCell[br][bc]) {
          continue
        }
        newBoxes = cur.boxes.slice()
        newBoxes[bi] = { r: br, c: bc }
      }
      var key = stateKey(nr, nc, newBoxes)
      //状态已搜索过则跳过
      if (visited[key]) {
        continue
      }
      visited[key] = true
      states++
      //超过搜索上限立即停止，避免卡死
      if (states > maxStates) {
        return { found: false, moves: [], states: states, limited: true }
      }
      prev[key] = { from: cur.key, move: dir.name }
      //所有箱子到位：沿 prev 链还原操作路径
      if (isGoal(map, newBoxes)) {
        var moves = []
        var k = key
        while (k !== startKey) {
          moves.unshift(prev[k].move)
          k = prev[k].from
        }
        return { found: true, moves: moves, states: states, limited: false }
      }
      queue.push({ pr: nr, pc: nc, boxes: newBoxes, key: key })
    }
  }
  return { found: false, moves: [], states: states, limited: true }
}

module.exports = {
  solve: solve,
  hasDeadlock: hasDeadlock
}
