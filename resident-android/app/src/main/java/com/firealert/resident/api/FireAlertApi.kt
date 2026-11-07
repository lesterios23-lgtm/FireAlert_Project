package com.firealert.resident.api

import com.firealert.resident.model.AuthResponse
import com.firealert.resident.model.FireReport
import com.firealert.resident.model.FireReportRequest
import com.firealert.resident.model.User
import retrofit2.Call
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface FireAlertApi {

    // Auth endpoints (like React post.js)
    @POST("auth/register")
    fun register(@Body request: RegisterRequest): Call<AuthResponse>

    @POST("auth/login")
    fun login(@Body request: LoginRequest): Call<AuthResponse>

    @POST("auth/logout")
    fun logout(@Header("Authorization") authHeader: String): Call<Void>

    @GET("auth/me")
    fun getMe(@Header("Authorization") authHeader: String): Call<User>

    // Resident report endpoints
    @POST("reports")
    fun createReport(@Body request: FireReportRequest): Call<FireReportResponse>

    @GET("reports")
    fun getMyReports(@Header("Authorization") authHeader: String): Call<List<FireReport>>

    @GET("reports/{id}")
    fun getReport(@Path("id") id: Int, @Header("Authorization") authHeader: String): Call<FireReport>

    @GET("users/{userId}/reports")
    fun getUserReports(
        @Path("userId") userId: Int,
        @Header("Authorization") authHeader: String
    ): Call<List<FireReport>>

    // Notifications
    @GET("notifications")
    fun getNotifications(@Header("Authorization") authHeader: String): Call<List<Notification>>

    @PATCH("notifications/{id}/read")
    fun markNotificationRead(
        @Path("id") id: Int,
        @Header("Authorization") authHeader: String
    ): Call<Void>
}

// Request/Response data classes

data class RegisterRequest(
    val name: String,
    val email: String,
    val password: String,
    val role: String = "resident"
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class FireReportRequest(
    val incidentDescription: String,
    val incidentAddress: String?,
    val latitude: Double?,
    val longitude: Double?,
    val locationSource: String?
)

data class FireReportResponse(
    val success: Boolean,
    val message: String,
    val data: FireReport?
)

data class Notification(
    val id: Int,
    val title: String,
    val message: String,
    val notificationType: String?,
    val readAt: String?,
    val createdAt: String
)