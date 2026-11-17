// 保留原图表的刻度、层次和装饰样式；业务数据由 options.js 注入。
export function template() { return {
  "series": [
    {
      "type": "gauge",
      "radius": "100%",
      "progress": {
        "show": true
      },
      "axisLine": {
        "lineStyle": {
          "width": 10
        }
      },
      "axisTick": {
        "show": false
      },
      "splitLine": {
        "distance": 5,
        "length": 5,
        "lineStyle": {
          "width": 2,
          "color": "#999"
        }
      },
      "axisLabel": {
        "distance": 13,
        "color": "#999",
        "fontSize": 12,
        "formatter": function (val) {
                                    //解决刻度的值为浮点数问题
                                    return Math.ceil(val);
                                }
      },
      "anchor": {
        "show": true,
        "showAbove": true,
        "size": 10,
        "itemStyle": {
          "borderWidth": 5
        }
      },
      "title": {
        "show": false
      },
      "detail": {
        "valueAnimation": true,
        "offsetCenter": [
          0,
          "70%"
        ]
      },
      "data": [

      ]
    }
  ]
} }
export function pointStyles() { return [
  {

  }
] }
