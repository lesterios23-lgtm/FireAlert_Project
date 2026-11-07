package com.firealert.resident.ui.report

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.firealert.resident.R
import com.firealert.resident.api.ApiClient
import com.firealert.resident.api.FireAlertApi
import com.firealert.resident.model.FireReportRequest
import com.firealert.resident.model.FireReportResponse
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import retrofit2.Call
import retrofit2.Callback
import retrofit2.Response

class ReportFormActivity : AppCompatActivity() {

    private lateinit var etDescription: EditText
    private lateinit var etAddress: EditText
    private lateinit var btnUseCurrentLocation: Button
    private lateinit var btnSelectOnMap: Button
    private lateinit var btnSubmitReport: Button
    private lateinit var tvLocationStatus: TextView
    private lateinit var apiService: FireAlertApi
    private lateinit var fusedLocationClient: FusedLocationProviderClient

    private var currentLatitude: Double? = null
    private var currentLongitude: Double? = null
    private var locationSource: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_report_form)

        etDescription = findViewById(R.id.etDescription)
        etAddress = findViewById(R.id.etAddress)
        btnUseCurrentLocation = findViewById(R.id.btnUseCurrentLocation)
        btnSelectOnMap = findViewById(R.id.btnSelectOnMap)
        btnSubmitReport = findViewById(R.id.btnSubmitReport)
        tvLocationStatus = findViewById(R.id.tvLocationStatus)
        apiService = ApiClient.apiService
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        btnUseCurrentLocation.setOnClickListener {
            requestLocationPermission()
        }

        btnSelectOnMap.setOnClickListener {
            locationSource = "manual"
            tvLocationStatus.text = "Location: Manual entry"
            tvLocationStatus.setTextColor(resources.getColor(R.color.text_secondary, theme))
            currentLatitude = null
            currentLongitude = null
            Toast.makeText(this, "Please enter the address manually above", Toast.LENGTH_SHORT).show()
        }

        btnSubmitReport.setOnClickListener {
            submitReport()
        }
    }

    private fun requestLocationPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), 1001)
        } else {
            getCurrentLocation()
        }
    }

    private fun getCurrentLocation() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return
        }
        fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
            if (location != null) {
                currentLatitude = location.latitude
                currentLongitude = location.longitude
                locationSource = "device"
                tvLocationStatus.text = "Location: GPS (${location.latitude}, ${location.longitude})"
                tvLocationStatus.setTextColor(resources.getColor(R.color.status_accepted, theme))
                etAddress.setHint("GPS location detected")
                Toast.makeText(this, "Location captured via GPS", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Unable to get location. Try manual entry.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 1001) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                getCurrentLocation()
            } else {
                Toast.makeText(this, getString(R.string.location_permission_denied), Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun submitReport() {
        val description = etDescription.text.toString().trim()
        val address = etAddress.text.toString().trim()

        if (description.isEmpty()) {
            etDescription.error = getString(R.string.error_required_field)
            etDescription.requestFocus()
            return
        }

        if (address.isEmpty() && (currentLatitude == null || currentLongitude == null)) {
            etAddress.error = getString(R.string.error_invalid_coordinates)
            etAddress.requestFocus()
            return
        }

        btnSubmitReport.isEnabled = false
        btnSubmitReport.text = getString(android.R.string.string_common_yes_action)

        val request = FireReportRequest(
            incidentDescription = description,
            incidentAddress = if (address.isNotEmpty()) address else null,
            latitude = currentLatitude,
            longitude = currentLongitude,
            locationSource = locationSource
        )

        apiService.createReport(request).enqueue(object : Callback<FireReportResponse> {
            override fun onResponse(call: Call<FireReportResponse>, response: Response<FireReportResponse>) {
                btnSubmitReport.isEnabled = true
                btnSubmitReport.text = getString(R.string.btn_submit_report)

                if (response.isSuccessful && response.body() != null) {
                    val result = response.body()!!
                    if (result.success) {
                        Toast.makeText(this@ReportFormActivity, getString(R.string.msg_report_submitted), Toast.LENGTH_SHORT).show()
                        finish()
                    } else {
                        Toast.makeText(this@ReportFormActivity, result.message ?: getString(R.string.msg_report_failed), Toast.LENGTH_LONG).show()
                    }
                } else {
                    Toast.makeText(this@ReportFormActivity, getString(R.string.msg_report_failed), Toast.LENGTH_LONG).show()
                }
            }

            override fun onFailure(call: Call<FireReportResponse>, t: Throwable) {
                btnSubmitReport.isEnabled = true
                btnSubmitReport.text = getString(R.string.btn_submit_report)
                Toast.makeText(this@ReportFormActivity, getString(R.string.error_network), Toast.LENGTH_LONG).show()
            }
        })
    }
}