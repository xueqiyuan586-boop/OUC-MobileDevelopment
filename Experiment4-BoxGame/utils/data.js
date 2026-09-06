//================
//地图数据map1~map4
//地图数据：1为墙、2为路、3为终点、4为箱子、5为人物、0为墙的外围
//================

//关卡1
var map1 = [
  [0, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 2, 2, 1, 1, 1, 0],
  [0, 1, 5, 4, 2, 2, 1, 0],
  [1, 1, 1, 2, 1, 2, 1, 1],
  [1, 3, 1, 2, 1, 2, 2, 1],
  [1, 3, 4, 2, 2, 1, 2, 1],
  [1, 3, 2, 2, 2, 4, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1]
]
//关卡2
var map2 = [
  [0, 0, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 3, 1, 0, 0, 0],
  [0, 0, 1, 2, 1, 1, 1, 1],
  [1, 1, 1, 4, 2, 4, 3, 1],
  [1, 3, 2, 4, 5, 1, 1, 1],
  [1, 1, 1, 1, 4, 1, 0, 0],
  [0, 0, 0, 1, 3, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 0, 0]
]
//关卡3
var map3 = [
  [0, 0, 1, 1, 1, 1, 0, 0],
  [0, 0, 1, 3, 3, 1, 0, 0],
  [0, 1, 1, 2, 3, 1, 1, 0],
  [0, 1, 2, 2, 4, 3, 1, 0],
  [1, 1, 2, 2, 5, 4, 1, 1],
  [1, 2, 2, 1, 4, 4, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1]
]
//关卡4
var map4 = [
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 3, 2, 3, 3, 1, 0],
  [0, 1, 3, 2, 4, 3, 1, 0],
  [1, 1, 1, 2, 2, 4, 1, 1],
  [1, 2, 4, 2, 2, 4, 2, 1],
  [1, 2, 1, 4, 1, 1, 2, 1],
  [1, 2, 2, 2, 5, 2, 2, 1],
  [1, 1, 1, 1, 1, 1, 1, 1]
]

//================
//星级评分配置：optimalSteps 直接取各关初始局面的最短解长度（由求解器计算，不手写）
//================

//关卡地图合集（与 export 的 maps 一致，供 getLevelMeta 使用）
var maps = [map1, map2, map3, map4]

//引用推箱子求解器（只在首次计算星级阈值时运行一次，结果缓存）
var solver = require('./solver.js')

//星级阈值缓存（首次计算后复用，避免重复求解）
var levelMetaCache = null

/**
 * 把原始地图数据拆成求解器需要的三层（地图/箱子/人物），只读不修改 maps
 */
function splitMap(mapData) {
  var map = []
  var box = []
  var player = null
  for (var i = 0; i < 8; i++) {
    map.push([])
    box.push([])
    for (var j = 0; j < 8; j++) {
      var v = mapData[i][j]
      //箱子进入箱子图层；人物记录坐标；两者在地图层都还原为路
      box[i][j] = v === 4 ? 4 : 0
      map[i][j] = (v === 4 || v === 5) ? 2 : v
      if (v === 5) {
        player = { row: i, col: j }
      }
    }
  }
  return { map: map, box: box, player: player }
}

/**
 * 获取四关的星级阈值：
 * optimalSteps = 初始局面最短解长度（步数不超过它拿3星）
 * twoStarSteps = 最优步数的1.3倍向上取整（步数不超过它拿2星，超过拿1星）
 */
function getLevelMeta() {
  if (levelMetaCache) {
    return levelMetaCache
  }
  levelMetaCache = maps.map(function (mapData, i) {
    var s = splitMap(mapData)
    var res = solver.solve(s.map, s.box, s.player)
    var optimal = res.found ? res.moves.length : 0
    return {
      id: i + 1,
      optimalSteps: optimal,
      twoStarSteps: Math.ceil(optimal * 1.3)
    }
  })
  return levelMetaCache
}

//使用module.exports语句暴露数据出口
module.exports = {
  maps: maps,
  getLevelMeta: getLevelMeta
}
