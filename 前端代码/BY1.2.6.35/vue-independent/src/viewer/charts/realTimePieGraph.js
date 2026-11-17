// 保留原图表的刻度、层次和装饰样式；业务数据由 options.js 注入。
export function template() { return {
  "tooltip": {
    "trigger": "item"
  },
  "legend": {
    "orient": "horizontal",
    "itemWidth": 10,
    "itemHeight": 10,
    "textStyle": {
      "color": "#000000",
      "fontSize": 14
    },
    "data": [

    ]
  },
  "series": [
    {
      "type": "pie",
      "radius": "95%",
      "center": [
        "50%",
        "60%"
      ],
      "data": [

      ],
      "label": {
        "show": true,
        "position": "inside",
        "color": "#000000",
        "fontSize": 14,
        "formatter": function(params ){
                                return params.value;
                            }
      },
      "labelLine": {
        "show": true
      },
      "emphasis": {
        "itemStyle": {
          "shadowBlur": 10,
          "shadowOffsetX": 0,
          "shadowColor": "rgba(0, 0, 0, 0.5)"
        }
      }
    }
  ]
} }
export function pointStyles() { return [
  {

  }
] }
