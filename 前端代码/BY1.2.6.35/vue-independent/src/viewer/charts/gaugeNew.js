// 保留原图表的刻度、层次和装饰样式；业务数据由 options.js 注入。
export function template() { return {
  "series": [
    {
      "min": 0,
      "max": 100,
      "type": "gauge",
      "radius": "100%",
      "axisLine": {
        "lineStyle": {
          "width": 10,
          "color": [
            [
              1,
              "#E6EBF8"
            ]
          ]
        }
      },
      "splitLine": {
        "show": true,
        "length": 10,
        "distance": 5,
        "lineStyle": {
          "color": "#63677A",
          "width": 3,
          "type": "solid",
          "dashOffset": 0,
          "cap": "butt",
          "join": "bevel",
          "miterLimit": 10
        }
      },
      "axisTick": {
        "lineStyle": {
          "color": "#63677A"
        }
      },
      "axisLabel": {
        "color": "#464646",
        "formatter": function (val) {
                              //解决刻度的值为浮点数问题
                              //return Math.ceil(val);
                              return val;
                          }
      },
      "pointer": {
        "show": true,
        "showAbove": true,
        "offsetCenter": [
          0,
          0
        ],
        "length": "55%",
        "width": 6,
        "keepAspect": false,
        "itemStyle": {
          "color": "#5C7BD9"
        }
      },
      "title": {
        "show": false
      },
      "progress": {
        "show": true
      },
      "detail": {
        "valueAnimation": true,
        "formatter": "{value}"
      },
      "data": [

      ]
    }
  ]
} }
export function pointStyles() { return [
  {
    "detail": {
      "color": "#464646"
    },
    "itemStyle": {
      "color": "#5C7BD9"
    }
  }
] }
