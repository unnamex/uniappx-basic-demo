# outsider-layout 页面／容器自适应布局
> **组件名：outsider-layout**

本组件采用CSS flex，零Script代码实现在父容器中的上、下、左、中、右自适应布局。本组件要解决问题包括：

1. 实现在父容器中的上、下、左、中、右自适应布局(先上下、后左右)，自动填满父容器。
2. 提供header、footer、left、right四个具名插槽及一个default插槽，分别对应上、下、左、右、中。
3. 自动过滤未定义的插槽，default插槽自适应容器大小、自动滚动条。
4. 目前提供left-width及right-width两个属性，用于定义左、右的宽度，若无则由内容确定宽度。
