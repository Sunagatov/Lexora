package com.zufar.bookshelf.config;

import com.zufar.bookshelf.dao.user.model.Role;
import com.zufar.bookshelf.dao.user.model.User;
import com.zufar.bookshelf.service.UserService;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;

@Service("customUserDetailsService")
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final BCryptPasswordEncoder passwordEncoder;
    private final UserService userService;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String login) throws UsernameNotFoundException {
        final User user;
        try {
            user = userService.getByLogin(login);
        } catch (Exception exc) {
            final String errorMessage = "Loading user details is impossible.";
            throw new UsernameNotFoundException(errorMessage, exc);
        }
        return new CustomUserDetails(
                user.getRoles(),
                passwordEncoder.encode(user.getPassword()),
                user.getFullName(),
                true,
                true,
                true,
                true
        );
    }

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class CustomUserDetails implements UserDetails {

        private Collection<Role> authorities;
        private String password;
        private String username;
        private boolean accountNonExpired;
        private boolean accountNonLocked;
        private boolean credentialsNonExpired;
        private boolean enabled;
    }
}
