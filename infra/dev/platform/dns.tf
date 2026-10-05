check "dns_configuration" {
  assert {
    condition     = var.route53_zone_id == null || var.dev_hostname != null
    error_message = "route53_zone_id requires dev_hostname; dev_hostname may use external DNS without a Route 53 zone."
  }
}

resource "aws_route53_record" "application" {
  count = var.route53_zone_id != null && var.dev_hostname != null ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.dev_hostname
  type    = "A"
  ttl     = 300
  records = [aws_eip.application.public_ip]
}
