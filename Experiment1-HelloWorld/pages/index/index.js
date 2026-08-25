Page({

  data: {
    names: ['girl', 'boy'],
    index: 0
  },

  onClick: function () {
    this.setData({
      index: 1 - this.data.index
    })
  }

})