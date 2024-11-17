var posts=["2024/10/11/hello-world/","2024/11/17/T265和D435的兼容性问题/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };