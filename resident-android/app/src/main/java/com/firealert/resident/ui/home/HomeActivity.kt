package com.firealert.resident.ui.home

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.firealert.resident.R
import com.firealert.resident.api.ApiClient
import com.firealert.resident.api.FireAlertApi
import com.firealert.resident.model.User
import com.firealert.resident.ui.auth.LoginActivity
import com.firealert.resident.ui.notification.NotificationActivity
import com.firealert.resident.ui.report.ReportFormActivity
import com.firealert.resident.ui.report.ReportListActivity
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class HomeActivity : AppCompatActivity() {

    private lateinit var tvWelcome: TextView
    private lateinit var btnReportEmergency: Button
    private lateinit var btnMyReports: Button
    private lateinit var btnNotifications: Button
    private lateinit var btnLogout: Button
    private lateinit var apiService: FireAlertApi

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_home)

        tvWelcome = findViewById(R.id.tvWelcome)
        btnReportEmergency = findViewById(R.id.btnReportEmergency)
        btnMyReports = findViewById(R.id.btnMyReports)
        btnNotifications = findViewById(R.id.btnNotifications)
        btnLogout = findViewById(R.id.btnLogout)
        apiService = ApiClient.apiService

        // Load user profile
        loadUserProfile()

        btnReportEmergency.setOnClickListener {
            val intent = Intent(this, ReportFormActivity::class.java)
            startActivity(intent)
        }

        btnMyReports.setOnClickListener {
            val intent = Intent(this, ReportListActivity::class.java)
            startActivity(intent)
        }

        btnNotifications.setOnClickListener {
            val intent = Intent(this, NotificationActivity::class.java)
            startActivity(intent)
        }

        btnLogout.setOnClickListener {
            confirmLogout()
        }
    }

    private fun loadUserProfile() {
        val token = ApiClient.getToken()
        if (token == null) return

        apiService.getMe(token).enqueue(object : Callback<User> {
            override fun onResponse(call: Call<User>, response: Response<User>) {
                if (response.isSuccessful && response.body() != null) {
                    val user = response.body()!!
                    tvWelcome.text = getString(R.string.welcome_message, user.name)
                }
            }

            override fun onFailure(call: Call<User>, t: Throwable) {
                // Silent failure - welcome message will just show without name
            }
        })
    }

    private fun confirmLogout() {
        AlertDialog.Builder(this)
            .setTitle(getString(R.string.title_logout_confirm))
            .setMessage(getString(R.string.msg_logout_confirm))
            .setNegativeButton(getString(R.string.btn_cancel), null)
            .setPositiveButton(getString(R.string.btn_sign_out)) { _, _ -> performLogout() }
            .show()
    }

    private fun performLogout() {
        val token = ApiClient.getToken()
        if (token != null) {
            apiService.logout(token).enqueue(object : Callback<Void> {
                override fun onResponse(call: Call<Void>, response: Response<Void>) {
                    clearSession()
                }

                override fun onFailure(call: Call<Void>, t: Throwable) {
                    clearSession()
                }
            })
        } else {
            clearSession()
        }
    }

    private fun clearSession() {
        ApiClient.clearToken()
        Toast.makeText(this, getString(R.string.msg_logout), Toast.LENGTH_SHORT).show()
        val intent = Intent(this, LoginActivity::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        startActivity(intent)
        finish()
    }
}