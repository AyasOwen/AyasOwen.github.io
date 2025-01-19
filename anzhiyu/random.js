var posts=["2024/11/20/Acfly相关库的安装/","2024/11/17/T265和D435联合使用/","2024/11/27/PX4开发之旅/","2025/01/14/Windown上python的环境配置/","2025/01/19/stm32之HAL库开发（一）/","2024/11/20/于-orangepi5-plus-上部署-ros1/","2024/11/27/于-orangepi5-plus-上部署-ros2/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };