"""
DebrisNet Conjunction & Collision Probability Engine
2D B-plane Gaussian Integral & Covariance Modeling (Foster-1992 / NASA CARA standard)
"""
import numpy as np


def compute_collision_probability_2d(
    miss_distance_vector: np.ndarray,
    v_relative: np.ndarray,
    cov1: np.ndarray,
    cov2: np.ndarray,
    hard_body_radius: float = 0.015  # km (e.g. 15m combined radius)
) -> float:
    """
    এনকাউন্টার বি-প্লেন (Encounter B-Plane)-এ প্রজেক্ট করে সংঘর্ষ সম্ভাবনা Pc বের করে।
    
    Args:
        miss_distance_vector: [x, y, z] km
        v_relative: [vx, vy, vz] km/s
        cov1: (3, 3) Primary satellite position covariance matrix (km^2)
        cov2: (3, 3) Secondary debris position covariance matrix (km^2)
        hard_body_radius: Combined sphere radius (km)

    Returns:
        P_c: Collision probability [0.0, 1.0]
    """
    v_rel_norm = np.linalg.norm(v_relative)
    if v_rel_norm < 1e-6:
        return 0.0

    # ১. এনকাউন্টার প্লেন (B-plane) অর্থোগোনাল বেসিস তৈরি (y_axis aligned with v_rel)
    u_y = v_relative / v_rel_norm
    
    # আর্বিট্রারি রেফারেন্স ভেক্টর নির্বাচন
    ref = np.array([1.0, 0.0, 0.0]) if abs(u_y[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
    u_x = np.cross(u_y, ref)
    u_x /= np.linalg.norm(u_x)
    u_z = np.cross(u_x, u_y)

    # প্রোজেকশন ম্যাট্রিক্স P (3 -> 2)
    proj_matrix = np.vstack([u_x, u_z])

    # ২. কম্বাইন্ড কোভেরিয়েন্স ম্যাট্রিক্স B-plane এ প্রজেকশন
    c_combined = cov1 + cov2
    c_2d = proj_matrix @ c_combined @ proj_matrix.T  # (2, 2)

    # মিস ডিসট্যান্স ভেক্টরকে 2D প্লেনে প্রজেক্ট করা
    miss_2d = proj_matrix @ miss_distance_vector

    # ৩. আইগেনভ্যালু ডিকম্পোজিশন (Principal axes rotation)
    eigenvals, eigenvecs = np.linalg.eigh(c_2d)
    sigma_x = np.sqrt(max(eigenvals[0], 1e-8))
    sigma_y = np.sqrt(max(eigenvals[1], 1e-8))

    # রোটেশন ম্যাট্রিক্স দিয়ে মিস ডিসট্যান্স রোটেট করা
    miss_rot = eigenvecs.T @ miss_2d
    x0, y0 = miss_rot[0], miss_rot[1]

    # ৪. সার্কুলার এরিয়া অ্যাপ্রক্সিমেশন (Foster-1992 analytical approximation)
    # P_c = [r_A^2 / (2π · sigma_x · sigma_y)] * exp(-0.5 * [(x0/sigma_x)^2 + (y0/sigma_y)^2])
    d_sq = (x0 / sigma_x) ** 2 + (y0 / sigma_y) ** 2
    r_sq = hard_body_radius ** 2

    # Correct Foster-1992 peak density * encounter area
    p_c = (r_sq / (2.0 * np.pi * sigma_x * sigma_y)) * np.exp(-0.5 * d_sq)

    return float(np.clip(p_c, 0.0, 1.0))


def default_leo_covariance(is_active_satellite: bool = True) -> np.ndarray:
    """
    LEO-র জন্য প্রমিত এরর এলিপ্সয়েড (In-track, Cross-track, Radial covariance km^2)
    """
    if is_active_satellite:
        # জিপিএস যুক্ত এক্টিভ স্যাটেলাইট (হাই অ্যাকিউরেসি: ~100m in-track, ~20m radial)
        return np.diag([0.02 ** 2, 0.10 ** 2, 0.02 ** 2])
    else:
        # ট্র্যাকড ডেব্রিস (TLE বেসড: ~800m in-track, ~150m radial)
        return np.diag([0.15 ** 2, 0.80 ** 2, 0.15 ** 2])
