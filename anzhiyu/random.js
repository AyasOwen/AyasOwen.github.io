var posts=["2024/11/20/Acfly相关库的安装/","2024/11/20/于-orangepi5-plus-上部署-ros/","2024/11/17/T265和D435联合使用/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };