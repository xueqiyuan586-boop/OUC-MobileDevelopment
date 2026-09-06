//公共存储工具：管理玩家信息、关卡进度、游戏设置与新手教程状态
//所有数据均保存在微信本地缓存中，不需要联网

//存储键名
var USER_KEY = 'sokoban_user'
var LEVELS_KEY = 'sokoban_completedLevels'
var SETTINGS_KEY = 'sokoban_settings'
var TUTORIAL_KEY = 'sokoban_hasSeenTutorial'
var PROGRESS_KEY = 'sokoban_levelProgress'

/**
 * 获取玩家信息（未登录时返回null）
 */
function getUser() {
  return wx.getStorageSync(USER_KEY) || null
}

/**
 * 保存玩家信息（nickName昵称 + avatar头像Emoji）
 */
function saveUser(user) {
  wx.setStorageSync(USER_KEY, user)
}

/**
 * 清除玩家信息（退出登录，不影响关卡进度）
 */
function clearUser() {
  wx.removeStorageSync(USER_KEY)
}

/**
 * 获取已通关的关卡列表（关卡从1开始编号，如[1, 2, 3]）
 */
function getCompletedLevels() {
  return wx.getStorageSync(LEVELS_KEY) || []
}

/**
 * 保存已通关的关卡列表
 */
function saveCompletedLevels(list) {
  wx.setStorageSync(LEVELS_KEY, list)
}

/**
 * 记录一个新通关的关卡（自动去重）
 */
function addCompletedLevel(level) {
  var list = getCompletedLevels()
  if (list.indexOf(level) < 0) {
    list.push(level)
    saveCompletedLevels(list)
  }
}

/**
 * 清除所有通关记录（重置游戏进度）
 */
function clearCompletedLevels() {
  wx.removeStorageSync(LEVELS_KEY)
}

/**
 * 获取每关成绩记录（关卡从1开始编号）
 * 结构：{ 1: { completed: true, bestSteps: 31, stars: 3 }, ... }
 */
function getLevelProgress() {
  return wx.getStorageSync(PROGRESS_KEY) || {}
}

/**
 * 获取某一关的成绩记录（未通关时返回null）
 */
function getLevelResult(level) {
  return getLevelProgress()[level] || null
}

/**
 * 记录一次通关成绩：只保留历史最好成绩
 * （星级更高，或星级相同但步数更少；更差的成绩不会覆盖）
 * 返回最终保存的记录，并同步旧的通关关卡列表（兼容原有进度功能）
 */
function recordLevelResult(level, steps, stars) {
  var progress = getLevelProgress()
  var old = progress[level]
  var entry = {
    completed: true,
    bestSteps: steps,
    stars: stars
  }
  if (old && old.completed) {
    //本次成绩更差：保留历史最好成绩
    if (old.stars > stars || (old.stars === stars && old.bestSteps <= steps)) {
      entry = old
    }
  }
  progress[level] = entry
  wx.setStorageSync(PROGRESS_KEY, progress)
  //同步旧的通关关卡列表（首页进度等原有功能继续可用）
  addCompletedLevel(level)
  return entry
}

/**
 * 清除所有成绩记录（重置游戏进度）
 */
function clearLevelProgress() {
  wx.removeStorageSync(PROGRESS_KEY)
}

/**
 * 获取游戏设置（缺失的字段自动补默认值，防止旧数据报错）
 */
function getSettings() {
  var defaults = {
    soundEnabled: true,
    vibrateEnabled: true,
    tipsEnabled: true
  }
  var saved = wx.getStorageSync(SETTINGS_KEY) || {}
  for (var key in defaults) {
    if (saved[key] === undefined) {
      saved[key] = defaults[key]
    }
  }
  return saved
}

/**
 * 保存游戏设置（只更新传入的字段，其余字段保持不变）
 */
function saveSettings(partial) {
  var settings = getSettings()
  for (var key in partial) {
    settings[key] = partial[key]
  }
  wx.setStorageSync(SETTINGS_KEY, settings)
}

/**
 * 是否已经看过新手教程
 */
function getTutorialSeen() {
  return !!wx.getStorageSync(TUTORIAL_KEY)
}

/**
 * 设置新手教程状态（true表示已看过，进入游戏不再自动弹出）
 */
function setTutorialSeen(seen) {
  wx.setStorageSync(TUTORIAL_KEY, !!seen)
}

module.exports = {
  getUser: getUser,
  saveUser: saveUser,
  clearUser: clearUser,
  getCompletedLevels: getCompletedLevels,
  saveCompletedLevels: saveCompletedLevels,
  addCompletedLevel: addCompletedLevel,
  clearCompletedLevels: clearCompletedLevels,
  getLevelProgress: getLevelProgress,
  getLevelResult: getLevelResult,
  recordLevelResult: recordLevelResult,
  clearLevelProgress: clearLevelProgress,
  getSettings: getSettings,
  saveSettings: saveSettings,
  getTutorialSeen: getTutorialSeen,
  setTutorialSeen: setTutorialSeen
}
