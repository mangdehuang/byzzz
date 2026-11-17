// 保留原图表的刻度、层次和装饰样式；业务数据由 options.js 注入。
export function template() { return {
  "title": {
    "show": false,
    "text": ""
  },
  "tooltip": {
    "trigger": "axis"
  },
  "legend": {
    "data": [

    ],
    "textStyle": {
      "color": "#000000",
      "fontStyle": "normal",
      "fontWeight": "normal",
      "fontFamily": "sans-serif",
      "fontSize": 14
    }
  },
  "grid": {
    "left": "3%",
    "right": "4%",
    "bottom": 5,
    "top": "30",
    "containLabel": true,
    "show": true
  },
  "toolbox": {
    "show": false,
    "feature": {
      "saveAsImage": {

      }
    }
  },
  "xAxis": {
    "type": "category",
    "boundaryGap": false,
    "data": [

    ],
    "axisLine": {
      "lineStyle": {
        "color": "#000000"
      }
    },
    "axisTick": {
      "lineStyle": {

      }
    },
    "axisLabel": {
      "textStyle": {
        "color": "#000000"
      },
      "fontSize": 14
    },
    "splitArea": {
      "interval": "auto",
      "show": false
    },
    "splitLine": {
      "show": true,
      "interval": "auto",
      "lineStyle": {
        "color": [
          "#0000ff"
        ]
      }
    }
  },
  "yAxis": {
    "type": "value",
    "axisLine": {

    },
    "axisTick": {

    },
    "axisLabel": {
      "textStyle": {
        "color": "#ff0000"
      },
      "fontSize": 14
    },
    "splitArea": {
      "interval": "auto",
      "show": false
    },
    "splitLine": {
      "show": true,
      "interval": "auto",
      "lineStyle": {
        "color": [
          "#995911"
        ]
      }
    }
  },
  "series": [

  ]
} }
export function pointStyles() { return [
  {

  },
  {

  },
  {

  },
  {

  },
  {

  }
] }
