# from flask import Flask, render_template, request, redirect, url_for
# from pymongo import MongoClient
# from bson.objectid import ObjectId
# from bson.errors import InvalidId

# app = Flask(__name__)

# # MongoDB configuration
# client = MongoClient("mongodb+srv://<db_username>:<db_password>@orderayard.pv0zwkr.mongodb.net/")
# db = client["ServerData"]
# game = db["game"]
# lobbyusers = db["lobbyusers"]
# players = db["players"]
# sessionusers = db["sessionusers"]
# # {{ url_for('foldername', filename='file')}}
# # 1. routes for separate pages
# @app.route('/')
# def main():
#     return render_template('mainpage.html')

# @app.route('/gamepage')
# def game():
#     return render_template('gamePage.html')

# @app.route('/hostgame')
# def accohostunt():
#     return render_template('hostGame.html')

# @app.route('/joingame')
# def Join():
#     return render_template('joinGame.html')



# @app.route('/lobbypage', methods=['GET', 'POST', 'PUT', 'DEL', 'PATCH'])
# def lobby():
   
#     if request.method == 'POST':

#     #USING LATER WHEN INFORMATION CAN BE ASSIGNED
#         # inputUserData = {
#     #         "username": request.form['username'],
#     #         "imageId": request.form['imageId'],
#     #         "email": request.form['email'],
#     #         "password": request.form['password'],
#     #         "conpassword": request.form['conpassword'],
#     #     }
#     #     userData.insert_one(inputUserData)
#     #     # return redirect(url_for('login'))
#     # return render_template('page1.html')

#     #     email = request.form['email']
#     #     password = request.form['password']
#     #     action = request.form['action']
#     #     if action == 'signup':
#     #         inputUserData = {
#     #         "username": request.form['username'],
#     #         # "imageId": request.form['imageId'],
#     #         "email": email,
#     #         "password": password,
#     #         "conpassword": request.form['conpassword'],
#     #         }
#     #         userData.insert_one(inputUserData)
#     #         return redirect(url_for('login'))
#     #     else:
#     #         user = userData.find_one({"email": email, "password": password})
#     #         if user:
#     #             return redirect (url_for('login'))
#     # return render_template('page1.html')


# @app.route('/videos')
# def videos():
#     return render_template('videos.html')

# @app.route('/websites')
# def websites():
#     return render_template('websites.html')


    
# if __name__ == '__main__':
#    app.run(debug=True)