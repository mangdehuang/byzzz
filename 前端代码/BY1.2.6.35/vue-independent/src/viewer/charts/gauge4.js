// 保留原图表的刻度、层次和装饰样式；业务数据由 options.js 注入。
export function template() { return {
  "series": [
    {
      "type": "gauge",
      "radius": "100%",
      "axisLine": {
        "lineStyle": {
          "width": 10,
          "color": [
            [
              0.3,
              "#67e0e3"
            ],
            [
              0.7,
              "#37a2da"
            ],
            [
              1,
              "#fd666d"
            ]
          ]
        }
      },
      "pointer": {
        "itemStyle": {
          "color": "auto"
        }
      },
      "axisTick": {
        "distance": -10,
        "length": 5,
        "lineStyle": {
          "color": "#fff",
          "width": 2
        }
      },
      "splitLine": {
        "distance": -10,
        "length": 10,
        "lineStyle": {
          "color": "#fff",
          "width": 2
        }
      },
      "axisLabel": {
        "color": "auto",
        "distance": 15,
        "fontSize": 14,
        "formatter": function (val) {
                                //解决刻度的值为浮点数问题
                                return Math.ceil(val);
                            }
      },
      "detail": {
        "valueAnimation": true,
        "color": "auto"
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
