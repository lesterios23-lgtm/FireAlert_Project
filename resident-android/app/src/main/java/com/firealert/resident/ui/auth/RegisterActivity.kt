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
import com.firealert.resident.model.RegisterRequest
import com.firealert.resident.ui.home.HomeActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class RegisterActivity : AppCompatActivity() {

    private lateinit var etName: EditText
    private lateinit var etEmail: EditText
    private lateinit var etPassword: EditText
    private lateinit var btnRegister: Button
    private lateinit var tvLoginLink: TextView
    private lateinit var apiService: FireAlertApi

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)

        etName = findViewById(R.id.etName)
        etEmail = findViewById(R.id.etEmail)
        etPassword = findViewById(R.id.etPassword)
        btnRegister = findViewById(R.id.btnRegister)
        tvLoginLink = findViewById(R.id.tvLoginLink)
        apiService = ApiClient.apiService

        btnRegister.setOnClickListener {
            attemptRegister()
        }

        tvLoginLink.setOnClickListener {
            finish()
        }
    }

    private fun attemptRegister() {
        val name = etName.text.toString().trim()
        val email = etEmail.text.toString().trim()
        val password = etPassword.text.toString().trim()

        if (name.isEmpty()) {
            etName.error = getString(R.string.error_required_field)
            etName.requestFocus()
            return
        }

        if (email.isEmpty()) {
            etEmail.error = getString(R.string.error_required_field)
            etEmail.requestFocus()
            return
        }

        if (password.isEmpty() || password.length < 8) {
            etPassword.error = "Password must be at least 8 characters"
            etPassword.requestFocus()
            return
        }

        btnRegister.isEnabled = false
        btnRegister.text = getString(android.R.string.string_common_yes_action)

        val request = RegisterRequest(name, email, password, "resident")
        apiService.register(request).enqueue(object : Callback<AuthResponse> {
            override fun onResponse(call: Call<AuthResponse>, response: Response<AuthResponse>) {
                btnRegister.isEnabled = true
                btnRegister.text = getString(R.string.btn_register)

                if (response.isSuccessful && response.body() != null) {
                    val authResponse = response.body()!!
                    val token = authResponse.data?.accessToken
                    if (token != null) {
                        ApiClient.setToken("Bearer $token")
                        ApiClient.saveToken(applicationContext, "Bearer $token")
                        Toast.makeText(this@RegisterActivity, getString(R.string.msg_registration_success), Toast.LENGTH_SHORT).show()
                        navigateToHome()
                    } else {
                        Toast.makeText(this@RegisterActivity, getString(R.string.error_registration_failed), Toast.LENGTH_LONG).show()
                    }
                } else {
                    Toast.makeText(this@RegisterActivity, getString(R.string.error_registration_failed), Toast.LENGTH_LONG).show()
                }
            }

            override fun onFailure(call: Call<AuthResponse>, t: Throwable) {
                btnRegister.isEnabled = true
                btnRegister.text = getString(R.string.btn_register)
                Toast.makeText(this@RegisterActivity, getString(R.string.error_network), Toast.LENGTH_LONG).show()
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