// 保留原图表的刻度、层次和装饰样式；业务数据由 options.js 注入。
export function template() { return {
  "series": [
    {
      "radius": "100%",
      "type": "liquidFill",
      "data": [

      ],
      "color": [
        "#0066ff"
      ],
      "amplitude": "3%",
      "waveLength": "80%",
      "backgroundStyle": {
        "borderWidth": 0,
        "borderColor": "#0000ff",
        "color": "#ccfffd"
      },
      "label": {
        "show": false
      },
      "outline": {
        "show": false
      },
      "shape": "rect"
    }
  ]
} }
export function pointStyles() { return [
  {

  }
] }
