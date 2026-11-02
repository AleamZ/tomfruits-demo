import { useState } from "react";
import { Form, Input, Button, Card, Typography, Row, Col, message } from "antd";
import { LockOutlined, MailOutlined } from "@ant-design/icons";
import { useNavigate, Link } from "react-router-dom";
import smewLogo from "../assets/logo-smew.png";
import {
  loginService,
  LoginRequest,
  setToken,
  setRefreshToken,
} from "@/services/auth.service";

const { Title } = Typography;

const LoginLayout = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const demoCredentials = { email: "tiendat@gmail.com", password: "123456" };

  const onFinish = async (values: LoginRequest) => {
    setLoading(true);
    try {
      const response = await loginService(values);

      // Check if response matches expected structure
      if (response.ok && response.data && response.data.accessToken) {
        // Store tokens from the data property
        setToken(response.data.accessToken);
        if (response.data.refreshToken) {
          setRefreshToken(response.data.refreshToken);
        }

        // Show success message and redirect
        message.success(response.message || "Login successful!");
        navigate("/");
      } else {
        // Handle unexpected response format
        message.error("Login response invalid. Please contact support.");
      }
    } catch (error: unknown) {
      // Handle API error response with detailed feedback
      console.error("Login failed:", error);

      // Format error message based on common API error structures
      let errorMessage = "Login failed. Please try again.";

      if (typeof error === "object" && error !== null) {
        interface ApiError {
          message?: string | string[];
          error?: string;
        }

        const err = error as ApiError;

        if (Array.isArray(err.message)) {
          // If message is an array of validation errors
          errorMessage = err.message.join(", ");
        } else if (typeof err.message === "string") {
          // If message is a string
          errorMessage = err.message;
        } else if (err.error && typeof err.error === "string") {
          // Some APIs return error in the 'error' field
          errorMessage = err.error;
        }
      }

      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row
      justify="center"
      align="middle"
      style={{ minHeight: "100vh", background: "#f0f2f5" }}
    >
      <Col xs={22} sm={16} md={12} lg={8} xl={6}>
        <Card style={{ boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }}>
          <div style={{ textAlign: "center", marginBottom: 12 }}>
            <img
              src={smewLogo}
              alt="SMEW Technology"
              style={{ width: 180, maxWidth: "70%", height: "auto" }}
            />
          </div>
          <Title
            level={2}
            style={{ textAlign: "center", marginBottom: "20px" }}
          >
            Login
          </Title>
          <Form
            name="login_form"
            form={form}
            initialValues={{ remember: true }}
            onFinish={onFinish}
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: "Please input your email!" },
                {
                  type: "email",
                  message: "Please enter a valid email address!",
                },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="Email"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: "Please input your password!" },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Password"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                style={{ width: "100%" }}
                size="large"
                loading={loading}
              >
                Login
              </Button>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'center' }}>
              <Link to="/forgot-password">
                Quên mật khẩu?
              </Link>
            </Form.Item>

            <Form.Item style={{ marginTop: 12 }}>
              <div style={{
                textAlign: 'center',
                marginBottom: 8,
                color: '#8c8c8c',
                fontSize: 12
              }}>
                Tài khoản demo: {demoCredentials.email} / {demoCredentials.password}
              </div>
              <Button
                block
                onClick={() => form.setFieldsValue(demoCredentials)}
              >
                Tự động điền tài khoản demo
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

export default LoginLayout;
