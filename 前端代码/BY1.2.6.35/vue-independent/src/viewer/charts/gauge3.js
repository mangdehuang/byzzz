// 保留原图表的刻度、层次和装饰样式；业务数据由 options.js 注入。
export function template() { return {
  "series": [
    {
      "type": "gauge",
      "radius": "100%",
      "startAngle": 180,
      "endAngle": 0,
      "min": 0,
      "max": 240,
      "splitNumber": 12,
      "itemStyle": {
        "color": "#58D9F9",
        "shadowColor": "rgba(0,138,255,0.45)",
        "shadowBlur": 10,
        "shadowOffsetX": 2,
        "shadowOffsetY": 2
      },
      "progress": {
        "show": true,
        "roundCap": true,
        "width": 10
      },
      "pointer": {
        "icon": "path://M2090.36389,615.30999 L2090.36389,615.30999 C2091.48372,615.30999 2092.40383,616.194028 2092.44859,617.312956 L2096.90698,728.755929 C2097.05155,732.369577 2094.2393,735.416212 2090.62566,735.56078 C2090.53845,735.564269 2090.45117,735.566014 2090.36389,735.566014 L2090.36389,735.566014 C2086.74736,735.566014 2083.81557,732.63423 2083.81557,729.017692 C2083.81557,728.930412 2083.81732,728.84314 2083.82081,728.755929 L2088.2792,617.312956 C2088.32396,616.194028 2089.24407,615.30999 2090.36389,615.30999 Z",
        "length": "60%",
        "width": 6,
        "offsetCenter": [
          0,
          "5%"
        ]
      },
      "axisLine": {
        "roundCap": true,
        "lineStyle": {
          "width": 10
        }
      },
      "axisTick": {
        "splitNumber": 2,
        "lineStyle": {
          "width": 2,
          "color": "#999"
        }
      },
      "splitLine": {
        "distance": 5,
        "length": 10,
        "lineStyle": {
          "width": 2,
          "color": "#999"
        }
      },
      "axisLabel": {
        "distance": 15,
        "color": "#999",
        "formatter": function (val) {
                                //解决刻度的值为浮点数问题
                                return Math.ceil(val);
                            }
      },
      "title": {
        "show": false
      },
      "detail": {
        "show": true,
        "valueAnimation": true,
        "offsetCenter": [
          0,
          "-25%"
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
