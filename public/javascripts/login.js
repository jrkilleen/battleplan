$(document).ready(function(){
	var failedlogincount = 0;
	 $(document).bind('keypress', function(e) {
            if(e.keyCode==13){
                 $('#login').trigger('click');
             }
        });

	$("#login").click(function(){
		var username = $("#username").val();
		var password = $("#password").val();
		// Checking for blank fields.
		if( username =='' || password ==''){
			$('input[type="text"],input[type="password"]').css("border","2px solid red");
			$('input[type="text"],input[tsype="password"]').css("box-shadow","0 0 3px red");

			$(".messages").text("Please fill all fields...!!!!!!").fadeIn();
		}else {
			$.post("login",{ username: username, password:password},function(data) {
				// if data is an error display it in a dialog box
	
				
				if(data[0] == 'E'){
					failedlogincount++;

					$(".messages" ).text("Login Failure " + failedlogincount).fadeIn( 300 ).delay( 1500 ).fadeOut( 400 );

				}else{
					$(".messages" ).text("Login Successful").fadeIn( 300 ).delay( 1500 ).fadeOut( 400 );

					window.location.replace("/main");
				}  
			});
		}
	});
});