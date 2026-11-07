package com.firealert.resident.api

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object ApiClient {

    private const val BASE_URL = "http://10.0.2.2:8000/api/v1/" // Android emulator localhost
    private const val PREF_NAME = "firealert_prefs"
    private const val KEY_TOKEN = "auth_token"

    private val gson: Gson = GsonBuilder()
        .setLenient()
        .create()

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BODY
    }

    private val okHttpClient = OkHttpClient.Builder()
        .addInterceptor(loggingInterceptor)
        .addInterceptor { chain ->
            val originalRequest = chain.request()
            val token = getToken()
            val builder = originalRequest.newBuilder()
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
            if (token != null && token.isNotEmpty()) {
                builder.header("Authorization", "Bearer $token")
            }
            chain.proceed(builder.build())
        }
        .build()

    private val retrofit: Retrofit = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create(gson))
        .build()

    val apiService: FireAlertApi by lazy { retrofit.create(FireAlertApi::class.java) }

    fun saveToken(context: Context, token: String) {
        val prefs: SharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_TOKEN, token).apply()
    }

    fun getToken(): String? {
        // This is a singleton, so we need a context. We'll use a mutable holder.
        return TokenHolder.token
    }

    fun setToken(token: String?) {
        TokenHolder.token = token
    }

    fun clearToken() {
        TokenHolder.token = null
    }

    private object TokenHolder {
        var token: String? = null
    }
}