// 保留原图表的刻度、层次和装饰样式；业务数据由 options.js 注入。
export function template() { return {
  "grid": {
    "left": "3%",
    "right": "4%",
    "bottom": 5,
    "top": 10,
    "containLabel": true
  },
  "xAxis": {
    "type": "category",
    "data": [

    ],
    "axisLine": {
      "lineStyle": {
        "color": "#000000"
      }
    },
    "axisLabel": {
      "textStyle": {
        "color": "#000000"
      },
      "fontSize": 14
    }
  },
  "yAxis": {
    "type": "value",
    "axisLabel": {
      "textStyle": {
        "color": "#ff0000"
      },
      "fontSize": 14
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
    {
      "data": [

      ],
      "type": "bar",
      "showBackground": true,
      "backgroundStyle": {
        "color": "rgba(180, 180, 180, 0.2)"
      },
      "label": {
        "color": "#000000",
        "show": true,
        "distance": 5,
        "fontSize": 14,
        "formatter": function(params){
                                return params.value+"A";
                            }
      },
      "itemStyle": {
        "color": function (params) {
                                var i=params.dataIndex;
                                var colorArray = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc','#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc','#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc','#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc','#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];
                                return colorArray[i];
                            }
      }
    }
  ]
} }
export function pointStyles() { return [
  {

  }
] }
