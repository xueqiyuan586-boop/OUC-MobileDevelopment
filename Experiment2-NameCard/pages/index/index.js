Page({

  data: {

  },


  // 分享给好友
  onShareAppMessage: function () {
    return {
      title: '薛淇元的个人名片',
      path: '/pages/index/index',
      imageUrl: '/images/profile-card.png'
    }
  }

})
