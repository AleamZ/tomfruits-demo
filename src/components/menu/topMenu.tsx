import { Row, Col } from 'antd';
import logoImage from '../../assets/logo-smew.png';
import { SettingOutlined, UserOutlined } from '@ant-design/icons';
import { Space, Dropdown, Menu } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getToken, clearTokens } from '@/services/auth.service';
import { decodeToken } from '../../utils/jwt.utils';

const TopMenu = () => {
    // State for authentication status
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userData, setUserData] = useState<{
        name?: string;
        email?: string;
        role?: string;
    }>({});
    const navigate = useNavigate();

    // Check login status on component mount
    useEffect(() => {
        const token = getToken();
        if (token) {
            // User is logged in
            setIsLoggedIn(true);

            // Decode token to get user information
            const decoded = decodeToken(token);
            if (decoded) {
                setUserData({
                    name: decoded.name || 'User',
                    email: decoded.email || '',
                    role: decoded.role || ''
                });
            }
        } else {
            setIsLoggedIn(false);
            setUserData({});
        }
    }, []);

    // Handle logout
    const handleLogout = () => {
        // Clear tokens
        clearTokens();

        // Update state
        setIsLoggedIn(false);
        setUserData({});

        // Redirect to login
        navigate('/login');
    };

    // Handle menu click
    const handleMenuClick = ({ key }: { key: string }) => {
        switch (key) {
            case 'profile':
                navigate('/profile');
                break;
            case 'settings':
                navigate('/account-settings');
                break;
            case 'logout':
                handleLogout();
                break;
            default:
                break;
        }
    };

    // Dropdown menu for logged in users
    const userMenu = (
        <Menu onClick={handleMenuClick}>

            <Menu.Item key="settings" icon={<SettingOutlined />}>
                Cài đặt tài khoản
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item key="logout">
                Đăng xuất
            </Menu.Item>
        </Menu>
    );

    return (
        <>
            <Row className='topMenu'>
                <Col span={2} ></Col>
                <Col span={20}>
                    <Row className='middle-header'>
                        <Col className="logo-container">
                            <Link to="/">
                                <img src={logoImage} alt="SMEW Technology" className="logo" />
                            </Link>
                        </Col>
                        <Col className='function-container'>
                            <div className="menu-icons" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <Space size={24}>
                                    {/* <Badge count={5} size="small">
                                        <BellOutlined style={{ fontSize: '20px', cursor: 'pointer' }} title="Thông báo" />
                                    </Badge>

                                    <SettingOutlined style={{ fontSize: '20px', cursor: 'pointer' }} title="Cài Đặt" /> */}

                                    {isLoggedIn ? (
                                        <Dropdown overlay={userMenu} placement="bottomRight">
                                            <span style={{ cursor: 'pointer' }}>
                                                <UserOutlined style={{ fontSize: '20px', marginRight: 8 }} />
                                                {userData.name}
                                                {userData.role && <small style={{ marginLeft: 4, color: '#888' }}>({userData.role})</small>}
                                            </span>
                                        </Dropdown>
                                    ) : (
                                        <div>
                                            <Link to="/register" style={{ color: 'inherit', textDecoration: 'none', marginRight: 8 }}>
                                                <span>Đăng ký</span>
                                            </Link>
                                            /
                                            <Link to="/login" style={{ color: 'inherit', textDecoration: 'none', marginLeft: 8 }}>
                                                <span>Đăng Nhập</span>
                                            </Link>
                                        </div>
                                    )}
                                </Space>
                            </div>
                        </Col>
                    </Row>
                </Col>
                <Col span={2} ></Col>
            </Row >
        </>
    )
}

export default TopMenu