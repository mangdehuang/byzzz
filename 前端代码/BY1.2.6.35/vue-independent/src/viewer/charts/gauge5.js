// 保留原图表的刻度、层次和装饰样式；业务数据由 options.js 注入。
export function template() { return {
  "series": [
    {
      "type": "gauge",
      "radius": "60%",
      "startAngle": 200,
      "endAngle": -20,
      "min": 0,
      "max": 60,
      "splitNumber": 12,
      "itemStyle": {
        "color": "#FFAB91"
      },
      "progress": {
        "show": true,
        "width": 15
      },
      "pointer": {
        "show": false
      },
      "axisLine": {
        "lineStyle": {
          "width": 15
        }
      },
      "axisTick": {
        "distance": -25,
        "splitNumber": 5,
        "lineStyle": {
          "width": 2,
          "color": "#999"
        }
      },
      "splitLine": {
        "distance": -30,
        "length": 14,
        "lineStyle": {
          "width": 2,
          "color": "#999"
        }
      },
      "axisLabel": {
        "distance": -15,
        "color": "#999",
        "fontSize": 14,
        "formatter": function (val) {
                                //解决刻度的值为浮点数问题
                                return Math.ceil(val);
                            }
      },
      "anchor": {
        "show": false
      },
      "title": {
        "show": false
      },
      "detail": {
        "valueAnimation": true,
        "width": "60%",
        "lineHeight": 40,
        "borderRadius": 8,
        "offsetCenter": [
          0,
          "-1%"
        ],
        "fontWeight": "bolder",
        "color": "auto"
      },
      "data": [

      ]
    },
    {
      "type": "gauge",
      "radius": "60%",
      "startAngle": 200,
      "endAngle": -20,
      "min": 0,
      "max": 60,
      "itemStyle": {
        "color": "#FD7347"
      },
      "progress": {
        "show": true,
        "width": 5
      },
      "pointer": {
        "show": false
      },
      "axisLine": {
        "show": false
      },
      "axisTick": {
        "show": false
      },
      "splitLine": {
        "show": false
      },
      "axisLabel": {
        "show": false
      },
      "detail": {
        "show": false
      },
      "data": [

      ]
    }
  ]
} }
export function pointStyles() { return [
  {

  },
  {

  }
] }
