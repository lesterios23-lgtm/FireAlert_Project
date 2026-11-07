package com.firealert.resident.ui.auth

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.firealert.resident.R
import com.firealert.resident.api.ApiClient
import com.firealert.resident.api.FireAlertApi
import com.firealert.resident.model.AuthResponse
import com.firealert.resident.model.LoginRequest
import com.firealert.resident.ui.home.HomeActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class LoginActivity : AppCompatActivity() {

    private lateinit var etEmail: EditText
    private lateinit var etPassword: EditText
    private lateinit var btnLogin: Button
    private lateinit var tvRegisterLink: TextView
    private lateinit var apiService: FireAlertApi

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        etEmail = findViewById(R.id.etEmail)
        etPassword = findViewById(R.id.etPassword)
        btnLogin = findViewById(R.id.btnLogin)
        tvRegisterLink = findViewById(R.id.tvRegisterLink)
        apiService = ApiClient.apiService

        btnLogin.setOnClickListener {
            attemptLogin()
        }

        tvRegisterLink.setOnClickListener {
            val intent = Intent(this, RegisterActivity::class.java)
            startActivity(intent)
        }
    }

    private fun attemptLogin() {
        val email = etEmail.text.toString().trim()
        val password = etPassword.text.toString().trim()

        if (email.isEmpty()) {
            etEmail.error = getString(R.string.error_required_field)
            etEmail.requestFocus()
            return
        }

        if (password.isEmpty()) {
            etPassword.error = getString(R.string.error_required_field)
            etPassword.requestFocus()
            return
        }

        btnLogin.isEnabled = false
        btnLogin.text = getString(android.R.string.string_common_yes_action) // Loading state like React

        val request = LoginRequest(email, password)
        apiService.login(request).enqueue(object : Callback<AuthResponse> {
            override fun onResponse(call: Call<AuthResponse>, response: Response<AuthResponse>) {
                btnLogin.isEnabled = true
                btnLogin.text = getString(R.string.btn_login)

                if (response.isSuccessful && response.body() != null) {
                    val authResponse = response.body()!!
                    val token = authResponse.data?.accessToken
                    if (token != null) {
                        ApiClient.setToken("Bearer $token")
                        // Save to SharedPreferences
                        ApiClient.saveToken(applicationContext, "Bearer $token")
                        Toast.makeText(this@LoginActivity, getString(R.string.msg_login_success), Toast.LENGTH_SHORT).show()
                        navigateToHome()
                    } else {
                        Toast.makeText(this@LoginActivity, getString(R.string.error_invalid_credentials), Toast.LENGTH_LONG).show()
                    }
                } else {
                    Toast.makeText(this@LoginActivity, getString(R.string.error_invalid_credentials), Toast.LENGTH_LONG).show()
                }
            }

            override fun onFailure(call: Call<AuthResponse>, t: Throwable) {
                btnLogin.isEnabled = true
                btnLogin.text = getString(R.string.btn_login)
                Toast.makeText(this@LoginActivity, getString(R.string.error_network), Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun navigateToHome() {
        val intent = Intent(this, HomeActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}