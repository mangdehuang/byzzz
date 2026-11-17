// 保留原图表的刻度、层次和装饰样式；业务数据由 options.js 注入。
export function template() { return {
  "grid": {
    "left": "0%",
    "right": "0%",
    "bottom": 15,
    "top": 15
  },
  "tooltip": {
    "trigger": "none"
  },
  "xAxis": {
    "data": [

    ],
    "axisTick": {
      "show": false
    },
    "axisLine": {
      "show": false
    },
    "axisLabel": {
      "show": false
    }
  },
  "yAxis": {
    "splitLine": {
      "show": false
    },
    "axisTick": {
      "show": false
    },
    "axisLine": {
      "show": false
    },
    "axisLabel": {
      "show": false
    }
  },
  "series": [
    {
      "name": "",
      "animation": false,
      "barWidth": "100%",
      "type": "pictorialBar",
      "symbolSize": [
        "100%",
        "30"
      ],
      "symbolOffset": [
        0,
        -15
      ],
      "z": 12,
      "itemStyle": {
        "opacity": 1,
        "color": "#363F5E"
      },
      "data": [

      ]
    },
    {
      "name": "",
      "animation": true,
      "barWidth": "100%",
      "type": "pictorialBar",
      "symbolSize": [
        "100%",
        "30"
      ],
      "symbolOffset": [
        0,
        -15
      ],
      "z": 12,
      "itemStyle": {
        "normal": {
          "color": "#00ff00"
        }
      },
      "data": [

      ]
    },
    {
      "name": "",
      "barWidth": "100%",
      "animation": false,
      "type": "pictorialBar",
      "symbolSize": [
        "100%",
        "30"
      ],
      "symbolOffset": [
        0,
        0
      ],
      "z": 12,
      "itemStyle": {
        "normal": {
          "color": "#00ff00"
        }
      },
      "data": [

      ]
    },
    {
      "name": "",
      "type": "bar",
      "animation": false,
      "itemStyle": {
        "opacity": 0.3,
        "color": "#363F5E"
      },
      "silent": true,
      "barWidth": "100%",
      "data": [

      ]
    },
    {
      "name": "",
      "animation": true,
      "type": "bar",
      "itemStyle": {
        "normal": {
          "color": "#00ff00",
          "opacity": 0.5
        }
      },
      "label": {
        "show": false,
        "position": "inside",
        "color": "#FFFE00",
        "fontSize": 18
      },
      "silent": true,
      "barWidth": "100%",
      "barGap": "-100%",
      "data": [

      ]
    }
  ]
} }
export function pointStyles() { return [
  {
    "symbolPosition": "end"
  },
  {
    "symbolPosition": "end"
  },
  {
    "symbolPosition": "center"
  },
  {

  },
  {

  }
] }
