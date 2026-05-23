# Preserve line numbers in stack traces for crash reporting.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor core is protected by its own bundled consumer rules.
# Keep plugin classes referenced by annotation in case any are missed.
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }

# @capacitor-firebase/authentication includes Facebook/Apple/Twitter handlers
# even when unused. Suppress missing-class warnings for optional providers.
-dontwarn com.facebook.CallbackManager$Factory
-dontwarn com.facebook.CallbackManager
-dontwarn com.facebook.FacebookCallback
-dontwarn com.facebook.login.LoginManager
-dontwarn com.facebook.login.widget.LoginButton
