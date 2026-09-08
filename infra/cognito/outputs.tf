output "aws_region" {
  description = "AWS region used by the Cognito User Pool."
  value       = var.aws_region
}

output "user_pool_id" {
  description = "Cognito User Pool identifier."
  value       = aws_cognito_user_pool.development.id
}

output "app_client_id" {
  description = "Public Cognito app client identifier; this is not a secret."
  value       = aws_cognito_user_pool_client.web.id
}

output "issuer_uri" {
  description = "Expected issuer for Cognito JWT validation."
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.development.id}"
}

output "jwk_set_uri" {
  description = "Cognito JSON Web Key Set endpoint."
  value       = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.development.id}/.well-known/jwks.json"
}

output "hosted_ui_domain" {
  description = "Cognito managed login domain, without a URI scheme, for Amplify Auth."
  value       = "${aws_cognito_user_pool_domain.development.domain}.auth.${var.aws_region}.amazoncognito.com"
}
